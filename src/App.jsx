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
  const [view, setView] = useState('profiles'); // 'profiles' | 'dashboard' | 'session' | 'notebook'

  // Estado de la lección activa
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

  // Síntesis de voz continua (Edge Neural TTS -> Respaldo voz alemana del dispositivo)
  const speakText = async (text, customRate = null) => {
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
      const audioUrl = await supabaseService.fetchEdgeTTS(text, tutorId, rate);
      if (audioUrl) {
        const audio = new Audio(audioUrl);
        audioPlayerRef.current = audio;
        audio.onended = () => setIsSpeaking(false);
        audio.onerror = () => setIsSpeaking(false);
        await audio.play();
        return;
      }
    } catch {
      // Fallback automático al motor del dispositivo
    }

    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'de-DE';
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
      setSuggestedReplies(lastTutor?.suggested_replies || []);
      setCompletedObjectives([]);
      if (lastTutor?.spoken_response) speakText(lastTutor.spoken_response);
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

      const firstMsg = {
        id: Date.now(),
        role: 'tutor',
        spoken_response: aiRes.spoken_response,
        german_focus: aiRes.german_focus,
        spanish_translation: aiRes.spanish_translation,
        suggested_replies: aiRes.suggested_replies || []
      };

      setMessages([firstMsg]);
      setSuggestedReplies(aiRes.suggested_replies || []);
      speakText(aiRes.spoken_response);

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

      const tutorMsg = {
        id: Date.now() + 1,
        role: 'tutor',
        spoken_response: aiRes.spoken_response,
        german_focus: aiRes.german_focus,
        spanish_translation: aiRes.spanish_translation,
        correction: aiRes.correction,
        suggested_replies: aiRes.suggested_replies || []
      };

      const finalMessages = [...updatedHistory, tutorMsg];
      setMessages(finalMessages);
      setSuggestedReplies(aiRes.suggested_replies || []);

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

      speakText(aiRes.spoken_response);
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

  // 1. Si no ha iniciado sesión -> Mostrar Login
  if (!authSession) {
    return <LoginScreen onLoginSuccess={(session) => setAuthSession(session)} />;
  }

  // 2. Selección de Perfil estilo Netflix
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

  // 3. Cuaderno de Vocabulario
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

  // 4. Sala de Práctica Minimalista
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

  // 5. Dashboard Principal
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