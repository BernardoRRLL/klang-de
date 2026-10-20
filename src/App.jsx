import React, { useState, useEffect, useRef } from 'react';
import { supabaseService } from './services/supabase';
import { generateTutorTurn } from './services/gemini';
import LoginScreen from './components/LoginScreen';
import ProfilePicker from './components/ProfilePicker';
import Dashboard from './components/Dashboard';
import PracticeRoom from './components/PracticeRoom';
import NotebookView from './components/NotebookView';

export default function App() {
  const [authSession, setAuthSession] = useState(() => supabaseService.getCurrentSession());
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState(null);
  const [view, setView] = useState('profiles');

  const [activeLesson, setActiveLesson] = useState(null);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [suggestedReplies, setSuggestedReplies] = useState([]);
  const [completedObjectives, setCompletedObjectives] = useState([]);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [apiError, setApiError] = useState('');

  const audioPlayerRef = useRef(null);
  const activeProfile = profiles.find((p) => p.id === activeProfileId) || null;

  const loadProfilesData = async () => {
    try {
      const dbProfiles = await supabaseService.getProfiles();
      const enriched = await Promise.all(
        (dbProfiles || []).map(async (p) => {
          const [completedLessons, notebook, savedSessions] = await Promise.all([
            supabaseService.getProgress(p.id),
            supabaseService.getVocabulary(p.id),
            supabaseService.getSessions(p.id)
          ]);
          return {
            ...p,
            speech_rate: Number(p.speech_rate || 0.85),
            completedLessons,
            notebook,
            savedSessions
          };
        })
      );
      setProfiles(enriched);
    } catch (err) {
      console.error('Error cargando perfiles:', err);
    }
  };

  useEffect(() => {
    if (authSession) {
      loadProfilesData();
    }
  }, [authSession]);

  // Se añade el parámetro lang para separar los motores de voz
  const speakText = async (text, customRate = null, lang = 'de') => {
    if (!text) return;
    const tutorId = activeProfile?.preferred_tutor || 'stefan';
    const rate = customRate || activeProfile?.speech_rate || 0.85;

    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();

    setIsSpeaking(true);

    try {
      // Pasamos el lang a la función por si klang-tts lo soporta en el futuro
      const audioUrl = await supabaseService.fetchEdgeTTS(text, tutorId, rate, lang);
      if (audioUrl) {
        const audio = new Audio(audioUrl);
        audioPlayerRef.current = audio;
        audio.onended = () => setIsSpeaking(false);
        audio.onerror = () => setIsSpeaking(false);
        await audio.play();
        return;
      }
    } catch {
      // Fallback
    }

    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === 'es' ? 'es-ES' : 'de-DE';
      utterance.rate = rate;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setIsSpeaking(false);
    }
  };

  const handleUpdateSetting = async (field, value) => {
    if (!activeProfile) return;
    setProfiles((prev) =>
      prev.map((p) => (p.id === activeProfile.id ? { ...p, [field]: value } : p))
    );
    await supabaseService.updateProfile(activeProfile.id, { [field]: value });
  };

  const handleStartLesson = async (lesson, existingSession = null) => {
    setActiveLesson(lesson);
    setApiError('');
    setView('session');

    if (existingSession && existingSession.messages?.length > 0) {
      setActiveSessionId(existingSession.id);
      setMessages(existingSession.messages);
      const lastTutor = [...existingSession.messages].reverse().find((m) => m.role === 'tutor');
      
      // Soporte retroactivo para sesiones antiguas
      setSuggestedReplies(lastTutor?.suggestions || lastTutor?.suggested_replies || []);
      setCompletedObjectives([]);
      
      if (lastTutor?.spanish_text) speakText(lastTutor.spanish_text, 1.0, 'es');
      else if (lastTutor?.german_text) speakText(lastTutor.german_text, undefined, 'de');
      else if (lastTutor?.spoken_response) speakText(lastTutor.spoken_response, undefined, 'de');
      return;
    }

    const newSessionId = crypto.randomUUID ? crypto.randomUUID() : `sess-${Date.now()}`;
    setActiveSessionId(newSessionId);
    setMessages([]);
    setSuggestedReplies([]);
    setCompletedObjectives([]);
    setIsAiThinking(true);

    try {
      const aiRes = await generateTutorTurn({
        userText: '',
        lesson,
        history: [],
        tutorId: activeProfile.preferred_tutor || 'stefan',
        correctionMode: activeProfile.correction_mode || 'strict',
        studentName: activeProfile.name,
        isInitial: true
      });

      // Mapeo al nuevo formato de Groq
      const firstMsg = {
        id: Date.now(),
        role: 'tutor',
        spanish_text: aiRes.spanish_text || '',
        german_text: aiRes.german_text || '',
        has_error: aiRes.has_error || false,
        correction_es: aiRes.correction_es || '',
        correction_de: aiRes.correction_de || '',
        suggestions: aiRes.suggestions || []
      };

      setMessages([firstMsg]);
      setSuggestedReplies(firstMsg.suggestions);
      
      if (firstMsg.spanish_text) speakText(firstMsg.spanish_text, 1.0, 'es');
      else if (firstMsg.german_text) speakText(firstMsg.german_text, undefined, 'de');

      const saved = await supabaseService.saveSession({
        id: newSessionId,
        profile_id: activeProfile.id,
        lesson_id: lesson.id,
        title: lesson.title,
        scenario_prompt: lesson.scenario,
        tutor_id: activeProfile.preferred_tutor || 'stefan',
        messages: [firstMsg]
      });

      if (saved) {
        setProfiles((prev) =>
          prev.map((p) =>
            p.id === activeProfile.id
              ? { ...p, savedSessions: [saved, ...(p.savedSessions || [])] }
              : p
          )
        );
      }
    } catch (err) {
      setApiError(err.message);
    } finally {
      setIsAiThinking(false);
    }
  };

  const handleSendUserTurn = async (userText) => {
    if (!userText.trim() || isAiThinking || !activeProfile) return;
    setApiError('');

    const userMsg = { id: Date.now(), role: 'user', text: userText.trim() };
    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setIsAiThinking(true);

    try {
      const aiRes = await generateTutorTurn({
        userText: userText.trim(),
        lesson: activeLesson,
        history: updatedHistory,
        tutorId: activeProfile.preferred_tutor || 'stefan',
        correctionMode: activeProfile.correction_mode || 'strict',
        studentName: activeProfile.name,
        isInitial: false
      });

      // Mapeo al nuevo formato de Groq
      const tutorMsg = {
        id: Date.now() + 1,
        role: 'tutor',
        spanish_text: aiRes.spanish_text || '',
        german_text: aiRes.german_text || '',
        has_error: aiRes.has_error || false,
        correction_es: aiRes.correction_es || '',
        correction_de: aiRes.correction_de || '',
        suggestions: aiRes.suggestions || []
      };

      const finalMessages = [...updatedHistory, tutorMsg];
      setMessages(finalMessages);
      setSuggestedReplies(tutorMsg.suggestions);

      // Prevención de errores si Groq omite estos arrays opcionales
      if (Array.isArray(aiRes.completed_objective_indexes)) {
        setCompletedObjectives((prev) =>
          Array.from(new Set([...prev, ...aiRes.completed_objective_indexes]))
        );
      }

      if (Array.isArray(aiRes.new_vocab) && aiRes.new_vocab.length > 0) {
        const vocabItems = aiRes.new_vocab.map((v) => ({ ...v, lessonId: activeLesson.id }));
        await supabaseService.upsertVocabulary(activeProfile.id, vocabItems);
        const updatedVocab = await supabaseService.getVocabulary(activeProfile.id);
        setProfiles((prev) =>
          prev.map((p) => (p.id === activeProfile.id ? { ...p, notebook: updatedVocab } : p))
        );
      }

      const saved = await supabaseService.saveSession({
        id: activeSessionId,
        profile_id: activeProfile.id,
        lesson_id: activeLesson.id,
        title: activeLesson.title,
        scenario_prompt: activeLesson.scenario,
        tutor_id: activeProfile.preferred_tutor || 'stefan',
        messages: finalMessages
      });

      if (saved) {
        setProfiles((prev) =>
          prev.map((p) =>
            p.id === activeProfile.id
              ? {
                  ...p,
                  savedSessions: [
                    saved,
                    ...(p.savedSessions || []).filter((s) => s.id !== saved.id)
                  ]
                }
              : p
          )
        );
      }

      if (tutorMsg.spanish_text) speakText(tutorMsg.spanish_text, 1.0, 'es');
      else if (tutorMsg.german_text) speakText(tutorMsg.german_text, undefined, 'de');

    } catch (err) {
      setApiError(err.message);
    } finally {
      setIsAiThinking(false);
    }
  };

  const handleExitLesson = async (markCompleted = false) => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (audioPlayerRef.current) audioPlayerRef.current.pause();

    if (markCompleted && activeProfile && activeLesson) {
      await supabaseService.markLessonCompleted(activeProfile.id, activeLesson.id);
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === activeProfile.id
            ? {
                ...p,
                completedLessons: Array.from(new Set([...(p.completedLessons || []), activeLesson.id]))
              }
            : p
        )
      );
    }
    setView('dashboard');
  };

  if (!authSession) {
    return <LoginScreen onLoginSuccess={(session) => setAuthSession(session)} />;
  }

  if (view === 'profiles' || !activeProfile) {
    return (
      <ProfilePicker
        profiles={profiles}
        onSelectProfile={(profile) => {
          setActiveProfileId(profile.id);
          setView('dashboard');
        }}
        onCreateProfile={async (newProf) => {
          await supabaseService.createProfile(newProf);
          await loadProfilesData();
        }}
        onUpdateProfile={async (id, updates) => {
          await supabaseService.updateProfile(id, updates);
          await loadProfilesData();
        }}
        onLogout={() => {
          supabaseService.signOut();
          setAuthSession(null);
        }}
      />
    );
  }

  if (view === 'notebook') {
    return (
      <NotebookView
        profile={activeProfile}
        onBack={() => setView('dashboard')}
        onSpeak={speakText}
        onDeleteWord={async (german) => {
          await supabaseService.deleteVocabularyItem(activeProfile.id, german);
          setProfiles((prev) =>
            prev.map((p) =>
              p.id === activeProfile.id
                ? { ...p, notebook: p.notebook.filter((w) => w.german !== german) }
                : p
            )
          );
        }}
      />
    );
  }

  if (view === 'session' && activeLesson) {
    return (
      <PracticeRoom
        lesson={activeLesson}
        tutorId={activeProfile.preferred_tutor || 'stefan'}
        speechRate={Number(activeProfile.speech_rate || 0.85)}
        micMode={activeProfile.mic_mode || 'ptt'}
        correctionMode={activeProfile.correction_mode || 'strict'}
        messages={messages}
        suggestedReplies={suggestedReplies}
        completedObjectives={completedObjectives}
        isAiThinking={isAiThinking}
        isSpeaking={isSpeaking}
        apiError={apiError}
        onSpeakText={speakText}
        onSendUserTurn={handleSendUserTurn}
        onUpdateSetting={handleUpdateSetting}
        onExitLesson={handleExitLesson}
      />
    );
  }

  return (
    <Dashboard
      profile={activeProfile}
      tutorId={activeProfile.preferred_tutor || 'stefan'}
      onChangeTutor={(newTutor) => handleUpdateSetting('preferred_tutor', newTutor)}
      onChangeProfile={() => setView('profiles')}
      onOpenNotebook={() => setView('notebook')}
      onStartLesson={handleStartLesson}
    />
  );
}
