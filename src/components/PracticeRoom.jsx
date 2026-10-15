import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, Volume2, ChevronLeft, SlidersHorizontal, Lightbulb,
  HelpCircle, CheckCircle2, Sparkles, X, Radio, AlertTriangle
} from 'lucide-react';
import { TUTORS } from '../data/curriculum';
import { translatePanicQuery } from '../services/gemini';

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
  const [liveTranscript, setLiveTranscript] = useState('');
  const [showHintsDrawer, setShowHintsDrawer] = useState(false);
  const [showSettingsSheet, setShowSettingsSheet] = useState(false);
  const [showPanicModal, setShowPanicModal] = useState(false);
  const [panicQuery, setPanicQuery] = useState('');
  const [panicResult, setPanicResult] = useState(null);
  const [isPanicLoading, setIsPanicLoading] = useState(false);

  const recognitionRef = useRef(null);
  const chatEndRef = useRef(null);

  const activeTutor = TUTORS[tutorId] || TUTORS.stefan;
  const userTurnsCount = messages.filter((m) => m.role === 'user').length;
  const progressPercent = Math.min(
    100,
    Math.round(
      ((userTurnsCount / MIN_TURNS_TO_COMPLETE) * 0.6 +
        (completedObjectives.length / (lesson?.objectives?.length || 3)) * 0.4) *
        100
    )
  );
  const canCompleteLesson = userTurnsCount >= MIN_TURNS_TO_COMPLETE;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiThinking]);

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Tu navegador no soporta reconocimiento de voz directo. Usa Chrome o Safari.');
      return;
    }

    if ('speechSynthesis' in window) window.speechSynthesis.cancel();

    const recognition = new SpeechRecognition();
    recognition.lang = 'de-DE';
    recognition.interimResults = true;
    recognition.continuous = micMode === 'ptt';

    let finalCollected = '';

    recognition.onstart = () => {
      setIsListening(true);
      setLiveTranscript('');
    };

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalCollected += transcript + ' ';
        } else {
          interim += transcript;
        }
      }
      const combined = (finalCollected + interim).trim();
      setLiveTranscript(combined);

      if (micMode === 'auto' && finalCollected.trim().length > 0) {
        recognition.stop();
        onSendUserTurn(finalCollected.trim());
        setLiveTranscript('');
      }
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListeningAndSend = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
    setIsListening(false);
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
      onSpeakText(res.german, 0.8);
    } catch {
      setPanicResult({
        german: 'Können Sie mir bitte helfen?',
        phonetic: 'Kénen zi mía bíte jélfen?',
        tip: 'Revisa tu conexión a internet.'
      });
    } finally {
      setIsPanicLoading(false);
    }
  };

  return (
    <div className="h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden select-none">
      {/* 1. CABECERA MINIMALISTA: Salir, Progreso Sutil y Botón de Ajustes */}
      <header className="px-4 pt-3 pb-2.5 flex items-center justify-between border-b border-slate-900/80 shrink-0">
        <button
          onClick={() => onExitLesson(false)}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white py-1"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Pausar y salir</span>
        </button>

        {/* Barra de progreso limpia al centro */}
        <div className="flex flex-col items-center flex-1 max-w-[180px] mx-4">
          <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-500 mt-1">
            {userTurnsCount}/{MIN_TURNS_TO_COMPLETE} intervenciones mínimas
          </span>
        </div>

        <div className="flex items-center gap-2">
          {canCompleteLesson && (
            <button
              onClick={() => onExitLesson(true)}
              className="px-3 py-1.5 rounded-full bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1 shadow-lg animate-fade-in"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Completar</span>
            </button>
          )}
          <button
            onClick={() => setShowSettingsSheet(true)}
            className="p-2 rounded-full bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
            title="Ajustes de voz y profesor"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. NÚCLEO VISUAL DE VOZ (EL ORBE RESPIRANDO EN ESPACIO LIMPIO) */}
      <div className="py-5 px-4 flex flex-col items-center justify-center border-b border-slate-900/60 bg-gradient-to-b from-slate-900/40 to-slate-950 shrink-0">
        <button
          onClick={() => {
            const lastTutor = [...messages].reverse().find((m) => m.role === 'tutor');
            if (lastTutor) onSpeakText(lastTutor.spoken_response);
          }}
          className={`relative w-20 h-20 rounded-full bg-gradient-to-br ${activeTutor.accentColor} flex items-center justify-center shadow-2xl ${activeTutor.glowColor} transition-all duration-300 ${
            isSpeaking ? 'scale-110 ring-8 ring-indigo-500/20' : isListening ? 'scale-105 ring-8 ring-rose-500/25' : ''
          }`}
        >
          <div className="flex items-center gap-1 h-7">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={`w-1.5 rounded-full bg-white transition-all duration-150 ${
                  isSpeaking
                    ? i % 2 === 0
                      ? 'h-7 animate-bounce'
                      : 'h-4 animate-pulse'
                    : isListening
                    ? 'h-5 bg-rose-200 animate-ping'
                    : 'h-2 opacity-80'
                }`}
              />
            ))}
          </div>
        </button>

        <div className="text-center mt-2.5">
          <span className="text-xs font-semibold text-slate-300">{activeTutor.name}</span>
          <span className="mx-1.5 text-slate-700">·</span>
          <span className="text-[11px] text-slate-400">
            {isSpeaking
              ? 'Hablándote...'
              : isListening
              ? 'Escuchando tu alemán...'
              : isAiThinking
              ? 'Pensando respuesta...'
              : `${speechRate}x · ${correctionMode === 'strict' ? 'Modo Estricto' : 'Modo Fluido'}`}
          </span>
        </div>
      </div>

      {/* Alerta transparente si ocurre algún problema de red/API */}
      {apiError && (
        <div className="mx-4 mt-2 rounded-2xl bg-rose-950/70 border border-rose-800 px-3.5 py-2 text-xs text-rose-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="truncate">{apiError}</span>
        </div>
      )}

      {/* 3. CONVERSACIÓN BILINGÜE DESPEJADA */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 max-w-2xl mx-auto w-full">
        {messages.map((msg) => {
          if (msg.role === 'user') {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[80%] rounded-3xl rounded-br-md bg-indigo-600 text-white px-4 py-2.5 shadow-sm flex items-center gap-2.5">
                  <p className="text-sm">{msg.text}</p>
                  <button
                    onClick={() => onSpeakText(msg.text, 0.9)}
                    className="p-1 rounded-full bg-indigo-700/70 text-indigo-200 hover:text-white shrink-0"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className="space-y-2">
              {/* Tarjeta de corrección limpia (solo si hubo algo que corregir) */}
              {msg.correction?.has_error && (
                <div className="rounded-2xl bg-amber-950/30 border border-amber-800/50 px-3.5 py-2.5 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-300">
                      💡 Mejor así: "{msg.correction.better_german}"
                    </span>
                    <button
                      onClick={() => onSpeakText(msg.correction.better_german, 0.75)}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-slate-900 text-amber-300"
                    >
                      🐢 Escuchar
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-300">{msg.correction.explanation}</p>
                </div>
              )}

              {/* Mensaje del Profesor */}
              <div className="rounded-3xl rounded-tl-md bg-slate-900/90 border border-slate-800/80 p-4 space-y-3 shadow-sm">
                <p className="text-sm text-slate-200 leading-relaxed">{msg.spoken_response}</p>

                {msg.german_focus && (
                  <div className="rounded-2xl bg-slate-950/90 border border-slate-800/80 p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-sm sm:text-base text-amber-300">
                        {msg.german_focus}
                      </p>
                      {msg.spanish_translation && (
                        <p className="text-xs text-slate-400 mt-0.5">{msg.spanish_translation}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => onSpeakText(msg.german_focus, 0.75)}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-900 text-xs text-slate-300 hover:text-white"
                        title="Escuchar lento"
                      >
                        🐢
                      </button>
                      <button
                        onClick={() => onSpeakText(msg.german_focus, speechRate)}
                        className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30"
                        title="Escuchar"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isAiThinking && (
          <div className="text-xs text-slate-500 italic px-2 animate-pulse">
            {activeTutor.name} está preparando su respuesta...
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* 4. BANDEJA DESPLEGABLE DE SUGERENCIAS (Solo se abre cuando quieres ayuda) */}
      {showHintsDrawer && suggestedReplies.length > 0 && (
        <div className="bg-slate-900 border-t border-slate-800 px-4 py-3 space-y-2 max-h-56 overflow-y-auto">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
              Frases sugeridas para responder ahora
            </span>
            <button
              onClick={() => setShowHintsDrawer(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Ocultar
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {suggestedReplies.map((reply, i) => (
              <div
                key={i}
                className="rounded-2xl bg-slate-950 border border-slate-800 p-2.5 flex flex-col justify-between gap-1.5"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-xs text-white">{reply.german}</p>
                    <button
                      onClick={() => onSpeakText(reply.german, 0.8)}
                      className="p-1 rounded-lg bg-slate-900 text-amber-300 shrink-0"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[11px] text-emerald-400 mt-0.5">{reply.spanish}</p>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-900">
                  <span className="text-[10px] text-slate-400 italic truncate">
                    [{reply.phonetic}]
                  </span>
                  <button
                    onClick={() => {
                      setShowHintsDrawer(false);
                      onSendUserTurn(reply.german);
                    }}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-indigo-950 text-indigo-300"
                  >
                    Usar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. BARRA INFERIOR DE CONTROLES LIMPIA (3 botones claros) */}
      <footer className="bg-slate-950 border-t border-slate-900 px-4 py-3 shrink-0">
        <div className="max-w-xl mx-auto space-y-2">
          {liveTranscript && (
            <div className="rounded-2xl bg-slate-900 border border-rose-500/40 px-3.5 py-2 text-xs text-center text-white">
              "{liveTranscript}"
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            {/* Botón 1: Ver Pistas */}
            <button
              onClick={() => setShowHintsDrawer(!showHintsDrawer)}
              className={`p-3.5 rounded-2xl border transition flex items-center gap-1.5 text-xs font-semibold ${
                showHintsDrawer
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
              }`}
              title="Ver ideas de qué responder"
            >
              <Lightbulb className="w-5 h-5 text-amber-400" />
              <span className="hidden sm:inline">Pistas</span>
            </button>

            {/* Botón Central: Micrófono Principal */}
            <button
              onClick={() => (isListening ? stopListeningAndSend() : startListening())}
              disabled={isAiThinking}
              className={`flex-1 py-4 px-6 rounded-3xl font-bold text-sm flex items-center justify-center gap-2.5 shadow-xl transition-all ${
                isListening
                  ? 'bg-rose-600 text-white ring-4 ring-rose-500/30 animate-pulse'
                  : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white'
              }`}
            >
              {micMode === 'ptt' ? <Mic className="w-5 h-5" /> : <Radio className="w-5 h-5" />}
              <span>
                {isListening
                  ? micMode === 'ptt'
                    ? 'Toca para Enviar'
                    : 'Escuchando...'
                  : micMode === 'ptt'
                  ? 'Hablar'
                  : 'Iniciar Fluido'}
              </span>
            </button>

            {/* Botón 3: Salvavidas ¿Cómo digo...? */}
            <button
              onClick={() => {
                setPanicResult(null);
                setPanicQuery('');
                setShowPanicModal(true);
              }}
              className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white flex items-center gap-1.5 text-xs font-semibold"
              title="¿Cómo digo...?"
            >
              <HelpCircle className="w-5 h-5 text-sky-400" />
              <span className="hidden sm:inline">¿Cómo digo?</span>
            </button>
          </div>
        </div>
      </footer>

      {/* PANEL DESLIZABLE DE CONFIGURACIÓN DE LA SALA (Para no ensuciar la vista) */}
      {showSettingsSheet && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">Ajustes de la Conversación</h3>
              <button
                onClick={() => setShowSettingsSheet(false)}
                className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1.5">Profesor</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.values(TUTORS).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => onUpdateSetting('preferred_tutor', t.id)}
                      className={`py-2.5 rounded-2xl font-bold border ${
                        tutorId === t.id
                          ? 'bg-indigo-600/20 border-indigo-500 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5">Velocidad de voz en alemán</label>
                <div className="grid grid-cols-3 gap-2">
                  {[0.75, 0.85, 1.0].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => onUpdateSetting('speech_rate', rate)}
                      className={`py-2.5 rounded-2xl font-bold border ${
                        speechRate === rate
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      {rate}x {rate === 0.75 ? '(Lento)' : rate === 0.85 ? '(Media)' : '(Normal)'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5">Modo del Micrófono</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onUpdateSetting('mic_mode', 'ptt')}
                    className={`py-2.5 rounded-2xl font-bold border ${
                      micMode === 'ptt'
                        ? 'bg-indigo-600/20 border-indigo-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    Walkie-Talkie
                  </button>
                  <button
                    onClick={() => onUpdateSetting('mic_mode', 'auto')}
                    className={`py-2.5 rounded-2xl font-bold border ${
                      micMode === 'auto'
                        ? 'bg-teal-600/20 border-teal-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    Manos Libres
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5">Estilo de Corrección</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onUpdateSetting('correction_mode', 'strict')}
                    className={`py-2.5 rounded-2xl font-bold border ${
                      correctionMode === 'strict'
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    Profesor Estricto
                  </button>
                  <button
                    onClick={() => onUpdateSetting('correction_mode', 'fluid')}
                    className={`py-2.5 rounded-2xl font-bold border ${
                      correctionMode === 'fluid'
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    Charla Fluida
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SALVAVIDAS "¿CÓMO DIGO...?" */}
      {showPanicModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-white">¿Cómo le digo en alemán...?</h3>
              <button
                onClick={() => setShowPanicModal(false)}
                className="p-1 rounded-full bg-slate-800 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePanicTranslate} className="flex gap-2">
              <input
                type="text"
                value={panicQuery}
                onChange={(e) => setPanicQuery(e.target.value)}
                placeholder="Ej: ¿Cómo digo que quiero pagar con tarjeta?"
                className="flex-1 rounded-2xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                disabled={isPanicLoading}
                className="px-4 py-2 rounded-2xl bg-amber-400 text-slate-950 font-bold text-xs"
              >
                {isPanicLoading ? '...' : 'Consultar'}
              </button>
            </form>

            {panicResult && (
              <div className="rounded-2xl bg-slate-950 border border-slate-800 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm text-amber-300">{panicResult.german}</p>
                  <button
                    onClick={() => onSpeakText(panicResult.german, 0.8)}
                    className="px-2.5 py-1 rounded-xl bg-slate-800 text-xs text-white flex items-center gap-1"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-amber-400" /> Escuchar
                  </button>
                </div>
                <p className="text-xs text-emerald-400">Suena: [{panicResult.phonetic}]</p>
                <p className="text-[11px] text-slate-400">{panicResult.tip}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}