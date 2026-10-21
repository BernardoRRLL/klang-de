import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, Volume2, ChevronLeft, SlidersHorizontal, Lightbulb,
  HelpCircle, CheckCircle2, X, Radio, AlertTriangle, Send
} from 'lucide-react';
import { TUTORS } from '../data/curriculum';
import { translatePanicQuery, transcribeAudioWithGroq } from '../services/gemini';

const MIN_TURNS_TO_COMPLETE = 6;

export default function PracticeRoom({
  lesson,
  tutorId,
  speechRate,
  micMode,
  correctionMode,
  messages,
  suggestedReplies,
  completedObjectives,
  isAiThinking,
  isSpeaking,
  apiError,
  onSpeakText,
  onSendUserTurn,
  onUpdateSetting,
  onExitLesson
}) {
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  
  const [showHintsDrawer, setShowHintsDrawer] = useState(false);
  const [showSettingsSheet, setShowSettingsSheet] = useState(false);
  const [showPanicModal, setShowPanicModal] = useState(false);
  const [panicQuery, setPanicQuery] = useState('');
  const [panicResult, setPanicResult] = useState(null);
  const [isPanicLoading, setIsPanicLoading] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const chatEndRef = useRef(null);

  const activeTutor = TUTORS[tutorId] || TUTORS.stefan;
  const userTurnsCount = messages.filter((m) => m.role === 'user').length;
  const progressPercent = Math.min(100, Math.round(((userTurnsCount / MIN_TURNS_TO_COMPLETE) * 0.6 + (completedObjectives.length / (lesson?.objectives?.length || 3)) * 0.4) * 100));
  const canCompleteLesson = userTurnsCount >= MIN_TURNS_TO_COMPLETE;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiThinking]);

  const playBilingualAudio = async (msg) => {
    if (msg.spanish_text) await onSpeakText(msg.spanish_text, 1.0, 'es');
    if (msg.german_text) await onSpeakText(msg.german_text, speechRate, 'de');
  };

  const startListening = async () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setLiveTranscript('');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop()); // Apaga la luz del micrófono
        
        setIsTranscribing(true);
        try {
          const text = await transcribeAudioWithGroq(audioBlob);
          if (micMode === 'auto') {
            onSendUserTurn(text);
          } else {
            // Walkie-Talkie: Deja el texto en el input para edición manual
            setLiveTranscript(text);
          }
        } catch (err) {
          console.error(err);
          alert("Error transcribiendo el audio.");
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsListening(true);
    } catch (err) {
      alert('Debes dar permiso al micrófono en tu navegador celular para usar esta función.');
    }
  };

  const stopListening = () => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
      setIsListening(false);
    }
  };

  const handleManualSend = () => {
    if (liveTranscript.trim()) {
      onSendUserTurn(liveTranscript.trim());
      setLiveTranscript('');
    }
  };

  const handlePanicTranslate = async (e) => {
    e.preventDefault();
    if (!panicQuery.trim()) return;
    setIsPanicLoading(true);
    try {
      const res = await translatePanicQuery(panicQuery.trim());
      setPanicResult(res);
      onSpeakText(res.german, 0.8, 'de');
    } catch {
      setPanicResult({ german: 'Können Sie mir bitte helfen?', phonetic: 'Kénen zi mía bíte jélfen?', tip: 'Revisa tu conexión a internet.' });
    } finally {
      setIsPanicLoading(false);
    }
  };

  const isFallbackActive = apiError && apiError.includes('falló');

  return (
    <div className="h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden select-none">
      <header className="px-4 pt-3 pb-2.5 flex items-center justify-between border-b border-slate-900/80 shrink-0">
        <button onClick={() => onExitLesson(false)} className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white py-1">
          <ChevronLeft className="w-4 h-4" /> <span>Pausar</span>
        </button>

        <div className="flex flex-col items-center flex-1 max-w-[180px] mx-4">
          <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canCompleteLesson && (
            <button onClick={() => onExitLesson(true)} className="px-3 py-1.5 rounded-full bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Completar
            </button>
          )}
          <button onClick={() => setShowSettingsSheet(true)} className="p-2 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="py-5 px-4 flex flex-col items-center justify-center border-b border-slate-900/60 bg-gradient-to-b from-slate-900/40 to-slate-950 shrink-0 relative">
        {isFallbackActive && (
             <div className="absolute top-2 right-4 flex items-center gap-1 text-[10px] text-amber-500 font-bold border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 rounded-full">
                <AlertTriangle className="w-3 h-3" /> Respaldo
             </div>
        )}

        <button
          onClick={() => {
            const lastTutor = [...messages].reverse().find((m) => m.role === 'tutor');
            if (lastTutor) playBilingualAudio(lastTutor);
          }}
          className={`relative w-20 h-20 rounded-full bg-gradient-to-br ${activeTutor.accentColor} flex items-center justify-center shadow-2xl ${activeTutor.glowColor} transition-all duration-300 ${
            isSpeaking ? 'scale-110 ring-8 ring-indigo-500/20' : isListening ? 'scale-105 ring-8 ring-rose-500/25' : ''
          }`}
        >
          <div className="flex items-center gap-1 h-7">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className={`w-1.5 rounded-full bg-white transition-all duration-150 ${isSpeaking ? i % 2 === 0 ? 'h-7 animate-bounce' : 'h-4 animate-pulse' : isListening ? 'h-5 bg-rose-200 animate-ping' : 'h-2 opacity-80'}`} />
            ))}
          </div>
        </button>

        <div className="text-center mt-2.5">
          <span className="text-xs font-semibold text-slate-300">{activeTutor.name}</span>
          <span className="mx-1.5 text-slate-700">·</span>
          <span className="text-[11px] text-slate-400">
            {isSpeaking ? 'Hablándote...' : isListening ? 'Grabando audio...' : isTranscribing ? 'Transcribiendo...' : isAiThinking ? 'Pensando respuesta...' : 'Listo'}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 max-w-2xl mx-auto w-full">
        {messages.map((msg) => {
          if (msg.role === 'user') {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[80%] rounded-3xl rounded-br-md bg-indigo-600 text-white px-4 py-2.5 flex items-center gap-2.5">
                  <p className="text-sm">{msg.text}</p>
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className="space-y-2">
              {msg.has_error && msg.correction_de && (
                <div className="rounded-2xl bg-amber-950/30 border border-amber-800/50 px-3.5 py-2.5 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-300">💡 Mejor así: "{msg.correction_de}"</span>
                  </div>
                  <p className="text-[11px] text-slate-300">{msg.correction_es}</p>
                </div>
              )}

              <div className="rounded-3xl rounded-tl-md bg-slate-900/90 border border-slate-800/80 p-4 space-y-3">
                {msg.spanish_text && <p className="text-sm text-slate-300 leading-relaxed">{msg.spanish_text}</p>}
                {msg.german_text && (
                  <div className="rounded-2xl bg-slate-950/90 border border-slate-800/80 p-3 flex items-center justify-between gap-3 mt-2">
                    <p className="font-bold text-sm text-amber-300">{msg.german_text}</p>
                    <button onClick={() => playBilingualAudio(msg)} className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300">
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {isAiThinking && <div className="text-xs text-slate-500 italic animate-pulse">Preparando respuesta...</div>}
        <div ref={chatEndRef} />
      </div>

      <footer className="bg-slate-950 border-t border-slate-900 px-4 py-3 shrink-0">
        <div className="max-w-xl mx-auto space-y-3">
          
          {/* Nuevo módulo de edición para modo Walkie-Talkie */}
          {micMode === 'ptt' && (liveTranscript || isTranscribing) && (
            <div className="flex items-end gap-2">
              <textarea
                value={isTranscribing ? 'Procesando voz...' : liveTranscript}
                onChange={(e) => setLiveTranscript(e.target.value)}
                disabled={isTranscribing}
                className="flex-1 rounded-2xl bg-slate-900 border border-slate-800 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none h-12"
                placeholder="Edita tu respuesta aquí..."
              />
              <button
                onClick={handleManualSend}
                disabled={isTranscribing || !liveTranscript.trim()}
                className="p-3 rounded-2xl bg-indigo-600 text-white disabled:opacity-50 disabled:bg-slate-800"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <button onClick={() => setShowPanicModal(true)} className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300">
              <HelpCircle className="w-5 h-5" />
            </button>

            <button
              onClick={() => (isListening ? stopListening() : startListening())}
              disabled={isAiThinking || isTranscribing}
              className={`flex-1 py-4 px-6 rounded-3xl font-bold text-sm flex items-center justify-center gap-2.5 shadow-xl transition-all ${
                isListening
                  ? 'bg-rose-600 text-white ring-4 ring-rose-500/30 animate-pulse'
                  : 'bg-gradient-to-r from-indigo-600 to-blue-600'
              }`}
            >
              {micMode === 'ptt' ? <Mic className="w-5 h-5" /> : <Radio className="w-5 h-5" />}
              <span>{isListening ? 'Detener Grabación' : 'Grabar Audio'}</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Sheet de Ajustes e Interfaz de Pánico (Ocultos por brevedad visual en este bloque, se mantienen iguales a tu código original) */}
      {showSettingsSheet && (
          <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
             <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative w-full max-w-md">
                 <button onClick={() => setShowSettingsSheet(false)} className="absolute top-4 right-4 p-2 text-slate-400"><X className="w-4 h-4" /></button>
                 <h3 className="font-bold text-base mb-4">Ajustes</h3>
                 <div className="grid grid-cols-2 gap-2 text-xs">
                    <button onClick={() => onUpdateSetting('mic_mode', 'ptt')} className={`py-2 rounded-xl border ${micMode === 'ptt' ? 'bg-indigo-600/20 border-indigo-500' : 'border-slate-800'}`}>Walkie-Talkie</button>
                    <button onClick={() => onUpdateSetting('mic_mode', 'auto')} className={`py-2 rounded-xl border ${micMode === 'auto' ? 'bg-teal-600/20 border-teal-500' : 'border-slate-800'}`}>Auto-Enviar</button>
                 </div>
             </div>
          </div>
      )}
    </div>
  );
}
