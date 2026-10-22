import React, { useState, useEffect, useRef } from 'react';
import { supabaseService } from './services/supabase';
import { generateTutorTurn } from './services/gemini';
import ErrorBoundary from './components/ErrorBoundary';
import LoginScreen from './components/LoginScreen';
import ProfilePicker from './components/ProfilePicker';
import Dashboard from './components/Dashboard';
import PracticeRoom from './components/PracticeRoom';
import NotebookView from './components/NotebookView';

// Función auxiliar para generar IDs seguros
const generateId = () => {
  return crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

function AppContent() {
  const [authSession, setAuthSession] = useState(() => supabaseService.getCurrentSession());
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState(null);
  const [view, setView] = useState('profiles'); // 'profiles' | 'dashboard' | 'session' | 'notebook'

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

  // Forzar la carga de voces en navegadores basados en WebKit/Chrome
  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  // Síntesis de voz nativa con selección de género
  const speakText = async (text, customRate = null, lang = 'de') => {
    if (!text) return;
    const rate = customRate || activeProfile?.speech_rate || 0.85;
    const tutorId = activeProfile?.preferred_tutor || 'stefan';

    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(true);

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === 'es' ? 'es-ES' : 'de-DE'; 
      utterance.rate = rate;
      
      // Escaneo de voces instaladas
      const voices = window.speechSynthesis.getVoices();
      const langPrefix = lang === 'es' ? 'es' : 'de';
      const availableVoices = voices.filter(v => v.lang.toLowerCase().startsWith(langPrefix));

      if (availableVoices.length > 0) {
        if (lang === 'de') {
          const maleNames = ['stefan', 'martin', 'markus', 'yannick', 'david', 'male', 'hombre'];
          const femaleNames = ['anna', 'helena', 'petra', 'hedda', 'katja', 'marlene', 'female', 'mujer'];

          let preferredVoice = null;

          if (tutorId === 'stefan') {
            preferredVoice = availableVoices.find(v => maleNames.some(name => v.name.toLowerCase().includes(name)));
          } else {
            preferredVoice = availableVoices.find(v => femaleNames.some(name => v.name.toLowerCase().includes(name)));
          }

          utterance.voice = preferredVoice || availableVoices.find(v => v.name.includes('Google')) || availableVoices[0];
        } else {
          utterance.voice = availableVoices.find(v => v.name.includes('Google')) || availableVoices[0];
        }
      }

      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      window.speechSynthesis.speak(utterance);
    } else {
      console.warn("Este navegador no soporta síntesis de voz nativa.");
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
      
      setSuggestedReplies(lastTutor?.suggestions || lastTutor?.suggested_replies || []);
      setCompletedObjectives([]);
      
      if (lastTutor?.spanish_text) speakText(lastTutor.spanish_text, 1.0, 'es');
      else if (lastTutor?.german_text) speakText(lastTutor.german_text, undefined, 'de');
      else if (lastTutor?.spoken_response) speakText(lastTutor.spoken_response, undefined, 'de');
      return;
    }

    const newSessionId = generateId();
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
        id: generateId(),
        role: 'tutor',
        spanish_text: aiRes.spanish_text || '',
        german_text: aiRes.german_text || '',
        translation_es: aiRes.translation_es || '', // <-- Recibimos la nueva traducción
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

    const userMsg = { id: generateId(), role: 'user', text: userText.trim() };
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
        id: generateId(),
        role: 'tutor',
        spanish_text: aiRes.spanish_text || '',
        german_text: aiRes.german_text || '',
        translation_es: aiRes.translation_es || '', // <-- Recibimos la nueva traducción
        has_error: aiRes.has_error || false,
        correction_es: aiRes.correction_es || '',
        correction_de: aiRes.correction_de || '',
        suggestions: aiRes.suggestions || []
      };

      const finalMessages = [...updatedHistory, tutorMsg];
      setMessages(finalMessages);
      setSuggestedReplies(tutorMsg.suggestions);

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

// Envolvemos todo el componente en el ErrorBoundary
export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
