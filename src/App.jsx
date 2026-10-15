import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, Volume2, RotateCcw, Sparkles, BookOpen, Settings, CheckCircle2,
  HelpCircle, ChevronLeft, User, ShieldAlert, Zap, Radio, Play,
  Trash2, Compass, Briefcase, Users, Key, Cloud, Check, RefreshCw,
  MessageSquare, History
} from 'lucide-react';

// ============================================================================
// CONFIGURACIÓN POR DEFECTO (Puedes rellenarlas aquí si tu repo de GitHub es Privado,
// o ingresarlas una sola vez desde el ícono de Engranaje ⚙️ en el teléfono)
// ============================================================================
const DEFAULT_SUPABASE_URL = import.meta?.env?.VITE_SUPABASE_URL || '';
const DEFAULT_SUPABASE_KEY = import.meta?.env?.VITE_SUPABASE_ANON_KEY || '';
const DEFAULT_GEMINI_KEY = import.meta?.env?.VITE_GEMINI_API_KEY || '';

// ============================================================================
// CLIENTE LIGERO SUPABASE REST (Cero dependencias externas, conecta a klang_*)
// ============================================================================
const createSupabaseClient = (url, key) => {
  const cleanUrl = url?.trim().replace(/\/$/, '');
  const cleanKey = key?.trim();
  const isConfigured = Boolean(cleanUrl && cleanKey);

  const headers = {
    apikey: cleanKey,
    Authorization: `Bearer ${cleanKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation'
  };

  return {
    isConfigured,
    async getProfiles() {
      if (!isConfigured) return null;
      const res = await fetch(`${cleanUrl}/rest/v1/klang_profiles?select=*`, { headers });
      if (!res.ok) throw new Error('Error leyendo klang_profiles');
      return res.json();
    },
    async updateProfile(id, updates) {
      if (!isConfigured) return null;
      const res = await fetch(`${cleanUrl}/rest/v1/klang_profiles?id=eq.${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ ...updates, updated_at: new Date().toISOString() })
      });
      return res.ok;
    },
    async getProgress(profileId) {
      if (!isConfigured) return [];
      const res = await fetch(
        `${cleanUrl}/rest/v1/klang_lesson_progress?profile_id=eq.${profileId}&select=lesson_id`,
        { headers }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return data.map((row) => row.lesson_id);
    },
    async markLessonCompleted(profileId, lessonId) {
      if (!isConfigured) return;
      await fetch(`${cleanUrl}/rest/v1/klang_lesson_progress?on_conflict=profile_id,lesson_id`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ profile_id: profileId, lesson_id: lessonId, completed: true })
      });
    },
    async getVocabulary(profileId) {
      if (!isConfigured) return [];
      const res = await fetch(
        `${cleanUrl}/rest/v1/klang_vocabulary?profile_id=eq.${profileId}&order=created_at.desc`,
        { headers }
      );
      if (!res.ok) return [];
      return res.json();
    },
    async upsertVocabulary(profileId, items) {
      if (!isConfigured || !items?.length) return;
      const payload = items.map((item) => ({
        profile_id: profileId,
        german: item.german,
        spanish: item.spanish,
        phonetic: item.phonetic || '',
        lesson_id: item.lessonId || 'custom'
      }));
      await fetch(`${cleanUrl}/rest/v1/klang_vocabulary?on_conflict=profile_id,german`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(payload)
      });
    },
    async deleteVocabularyItem(profileId, german) {
      if (!isConfigured) return;
      await fetch(
        `${cleanUrl}/rest/v1/klang_vocabulary?profile_id=eq.${profileId}&german=eq.${encodeURIComponent(german)}`,
        { method: 'DELETE', headers }
      );
    },
    async getSessions(profileId) {
      if (!isConfigured) return [];
      const res = await fetch(
        `${cleanUrl}/rest/v1/klang_sessions?profile_id=eq.${profileId}&order=updated_at.desc&limit=12`,
        { headers }
      );
      if (!res.ok) return [];
      return res.json();
    },
    async saveSession(sessionObj) {
      if (!isConfigured) return null;
      const res = await fetch(`${cleanUrl}/rest/v1/klang_sessions?on_conflict=id`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({
          ...sessionObj,
          updated_at: new Date().toISOString()
        })
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.[0] || null;
    },
    async fetchEdgeTTS(text, tutorId, rate) {
      if (!isConfigured) return null;
      // Llama a la Edge Function 'klang-tts' en tu proyecto de Supabase (si está desplegada)
      const voice = tutorId === 'stefan' ? 'de-DE-ConradNeural' : 'de-DE-KatjaNeural';
      const res = await fetch(`${cleanUrl}/functions/v1/klang-tts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cleanKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text, voice, rate })
      });
      if (!res.ok) return null;
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    }
  };
};

// ============================================================================
// CURRÍCULO BASE (7 SESIONES + TEMAS ABIERTOS A MEDIDA)
// ============================================================================
const CURRICULUM = [
  {
    id: 'm1',
    title: 'Ruta 1: Base y Supervivencia (Desde Cero)',
    icon: Compass,
    color: 'emerald',
    description: 'Andamiaje 70% español / 30% alemán para soltar la lengua sin estrés.',
    lessons: [
      {
        id: '1.1',
        title: 'Primeros Contactos y Sonidos Clave',
        level: 'A1.0',
        scenario: 'Tu primera sesión con el tutor. Aprenderás a saludar según la hora, presentarte con "Ich heiße..." y dominar el sonido de la W (como V) y la ß (doble s).',
        objectives: [
          'Saludar formalmente (Guten Morgen / Guten Tag)',
          'Decir tu nombre usando "Ich heiße..."',
          'Responder "Mucho gusto" (Freut mich)'
        ],
        starterVocab: [
          { german: 'Guten Morgen', spanish: 'Buenos días', phonetic: 'Gúten Mórguen' },
          { german: 'Ich heiße...', spanish: 'Me llamo...', phonetic: 'Ij jáise...' },
          { german: 'Freut mich', spanish: 'Mucho gusto', phonetic: 'Fróit mij' }
        ]
      },
      {
        id: '1.2',
        title: 'Números, Precios y la Panadería',
        level: 'A1.1',
        scenario: 'Practicarás los números del 1 al 10 y cómo pedir cosas amablemente en una cafetería en Berlín usando "Ich möchte..." (Me gustaría) y "Bitte".',
        objectives: [
          'Pedir un café o pan usando "Ich möchte..."',
          'Usar un número del 1 al 5 en tu pedido',
          'Preguntar cuánto cuesta ("Was kostet das?")'
        ],
        starterVocab: [
          { german: 'Ich möchte bitte...', spanish: 'Me gustaría por favor...', phonetic: 'Ij méjte bíte...' },
          { german: 'Zwei Kaffee', spanish: 'Dos cafés', phonetic: 'Tsvái Kafé' },
          { german: 'Was kostet das?', spanish: '¿Cuánto cuesta esto?', phonetic: 'Vas kóstet das?' }
        ]
      },
      {
        id: '1.3',
        title: 'Estructura Básica: Querer, Poder y Tener',
        level: 'A1.1',
        scenario: 'Conversación guiada para armar tus primeras frases propias combinando "Ich habe" (tengo), "Ich kann" (puedo) y "Ich brauche" (necesito).',
        objectives: [
          'Decir algo que tienes o necesitas hoy',
          'Responder una pregunta simple con Ja o Nein',
          'Pedir que hablen más despacio ("Langsamer, bitte")'
        ],
        starterVocab: [
          { german: 'Ich brauche Hilfe', spanish: 'Necesito ayuda', phonetic: 'Ij bráuje jílfe' },
          { german: 'Können Sie langsamer sprechen?', spanish: '¿Puede hablar más lento?', phonetic: 'Kénen zi lángzama shpréjen?' },
          { german: 'Ich verstehe', spanish: 'Entiendo', phonetic: 'Ij fershtée' }
        ]
      }
    ]
  },
  {
    id: 'm2',
    title: 'Ruta 2: Contexto Familiar y Cotidiano',
    icon: Users,
    color: 'amber',
    description: 'Situaciones reales del día a día: horarios, familia, colegio y compras.',
    lessons: [
      {
        id: '2.1',
        title: 'La Familia, los Niños y el Colegio',
        level: 'A1.1',
        scenario: 'Charla cotidiana para presentar a tu familia (pareja, hijos), hablar de actividades escolares y entender palabras clave del entorno escolar alemán.',
        objectives: [
          'Mencionar a tu familia ("Meine Familie / Meine Kinder")',
          'Hablar de un horario o pausa ("Die Pause / Der Stundenplan")',
          'Hacer una pregunta sobre la rutina diaria'
        ],
        starterVocab: [
          { german: 'Meine Tochter und mein Sohn', spanish: 'Mi hija y mi hijo', phonetic: 'Máine tójter und máin zón' },
          { german: 'Wann beginnt die Schule?', spanish: '¿Cuándo empieza el colegio?', phonetic: 'Van beguínt di shúle?' },
          { german: 'Die Pause', spanish: 'El recreo / la pausa', phonetic: 'Di páuse' }
        ]
      },
      {
        id: '2.2',
        title: 'Horarios, Fin de Semana y Actividades',
        level: 'A1.2',
        scenario: 'Planificando el fin de semana: hablar del clima, paseos al aire libre, deportes y coordinar horas del día.',
        objectives: [
          'Decir qué te gusta hacer el fin de semana',
          'Mencionar un día o una hora específica ("Am Samstag um 9 Uhr")',
          'Expresar preferencia con "Ich mag..."'
        ],
        starterVocab: [
          { german: 'Am Wochenende', spanish: 'El fin de semana', phonetic: 'Am vójen-ende' },
          { german: 'Um acht Uhr', spanish: 'A las ocho en punto', phonetic: 'Um ájt úa' },
          { german: 'Das Wetter ist schön', spanish: 'El clima está lindo', phonetic: 'Das véter ist shén' }
        ]
      }
    ]
  },
  {
    id: 'm3',
    title: 'Ruta 3: Mundo Profesional y Trabajo',
    icon: Briefcase,
    color: 'indigo',
    description: 'Presentaciones profesionales, reuniones, equipos y coordinación laboral.',
    lessons: [
      {
        id: '3.1',
        title: 'Presentar tu Rol y Experiencia',
        level: 'A1.2',
        scenario: 'Conoces a un colega alemán en una conferencia o llamada. Practicarás cómo explicar en qué trabajas, tu área (Recursos Humanos / Proyectos / Gestión) y tu empresa.',
        objectives: [
          'Decir tu profesión o área con "Ich arbeite im Bereich..."',
          'Mencionar de dónde vienes ("Ich komme aus Chile")',
          'Preguntar al colega a qué se dedica'
        ],
        starterVocab: [
          { german: 'Ich arbeite im Bereich Personal', spanish: 'Trabajo en el área de Personas/RRHH', phonetic: 'Ij árbajte im beráij perzonál' },
          { german: 'Ich komme aus Chile', spanish: 'Vengo de Chile', phonetic: 'Ij kóme áus Chíle' },
          { german: 'Was machen Sie beruflich?', spanish: '¿A qué se dedica usted?', phonetic: 'Vas májen zi berúflij?' }
        ]
      },
      {
        id: '3.2',
        title: 'Coordinar una Reunión e Indicadores',
        level: 'A2.1',
        scenario: 'Estás coordinando una reunión de equipo: agendar fecha, revisar números básicos de dotación o presupuesto y confirmar acuerdos.',
        objectives: [
          'Proponer una hora para la reunión ("Haben Sie Zeit um...?")',
          'Confirmar que todo está claro ("Alles klar / Einverstanden")',
          'Agradecer la conversación formalmente'
        ],
        starterVocab: [
          { german: 'Haben Sie morgen Zeit für ein Meeting?', spanish: '¿Tiene tiempo mañana para una reunión?', phonetic: 'Jáben zi mórguen tsáit füa áin míting?' },
          { german: 'Die Zahlen sind gut', spanish: 'Los números están bien', phonetic: 'Di tsálen zind gut' },
          { german: 'Vielen Dank für das Gespräch', spanish: 'Muchas gracias por la conversación', phonetic: 'Fílen dank füa das gueshpréij' }
        ]
      }
    ]
  }
];

const TUTORS = {
  stefan: {
    id: 'stefan',
    name: 'Stefan',
    gender: 'male',
    role: 'Profesor & Coach (Voz Masculina)',
    voiceHint: 'Conrad (Edge Neural) / Voz Masculina',
    accentColor: 'from-blue-500 to-indigo-600',
    ringColor: 'ring-blue-500/40'
  },
  clara: {
    id: 'clara',
    name: 'Clara',
    gender: 'female',
    role: 'Profesora & Coach (Voz Femenina)',
    voiceHint: 'Katja (Edge Neural) / Voz Femenina',
    accentColor: 'from-teal-500 to-emerald-600',
    ringColor: 'ring-emerald-500/40'
  }
};

export default function App() {
  // Credenciales (Supabase + Gemini)
  const [supabaseUrl, setSupabaseUrl] = useState(() => localStorage.getItem('klang_sb_url') || DEFAULT_SUPABASE_URL);
  const [supabaseKey, setSupabaseKey] = useState(() => localStorage.getItem('klang_sb_key') || DEFAULT_SUPABASE_KEY);
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('klang_gemini_key') || DEFAULT_GEMINI_KEY);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [syncStatus, setSyncStatus] = useState('local'); // 'synced' | 'syncing' | 'local' | 'error'

  const sb = createSupabaseClient(supabaseUrl, supabaseKey);

  // Perfiles y estado de navegación
  const [profiles, setProfiles] = useState({
    bernardo: {
      id: 'bernardo',
      name: 'Bernardo',
      role_description: 'Ruta Base + Mundo Corporativo y Cotidiano',
      avatar_color: 'from-blue-600 to-indigo-700',
      current_level: 'A1.0 (Desde Cero)',
      streak: 1,
      preferred_tutor: 'stefan',
      speech_rate: 0.85,
      mic_mode: 'ptt',
      correction_mode: 'strict',
      completedLessons: [],
      notebook: [],
      savedSessions: []
    },
    ceci: {
      id: 'ceci',
      name: 'Ceci',
      role_description: 'Ruta Base + Vida Cotidiana y Familiar',
      avatar_color: 'from-emerald-600 to-teal-700',
      current_level: 'A1.0 (Desde Cero)',
      streak: 1,
      preferred_tutor: 'clara',
      speech_rate: 0.85,
      mic_mode: 'ptt',
      correction_mode: 'fluid',
      completedLessons: [],
      notebook: [],
      savedSessions: []
    }
  });

  const [activeProfileId, setActiveProfileId] = useState(null);
  const [currentView, setCurrentView] = useState('profile_select'); // 'profile_select' | 'dashboard' | 'session' | 'notebook'
  const [activeLesson, setActiveLesson] = useState(null);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [customTopicInput, setCustomTopicInput] = useState('');

  // Controles en vivo de la Sala de Práctica
  const [tutorId, setTutorId] = useState('stefan');
  const [speechRate, setSpeechRate] = useState(0.85);
  const [micMode, setMicMode] = useState('ptt');
  const [correctionMode, setCorrectionMode] = useState('strict');

  // Estado de la conversación
  const [messages, setMessages] = useState([]);
  const [suggestedReplies, setSuggestedReplies] = useState([]);
  const [completedObjectives, setCompletedObjectives] = useState([]);
  const [sessionVocabAdded, setSessionVocabAdded] = useState([]);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');

  // Modal Botón de Pánico ("¿Cómo digo...?")
  const [showPanicModal, setShowPanicModal] = useState(false);
  const [panicQuery, setPanicQuery] = useState('');
  const [panicResult, setPanicResult] = useState(null);
  const [isPanicLoading, setIsPanicLoading] = useState(false);

  const recognitionRef = useRef(null);
  const chatEndRef = useRef(null);
  const audioPlayerRef = useRef(null);

  const activeProfile = activeProfileId ? profiles[activeProfileId] : null;
  const activeTutor = TUTORS[tutorId];

  // ============================================================================
  // CARGA INICIAL DESDE SUPABASE (klang_*)
  // ============================================================================
  const loadFromSupabase = async () => {
    if (!sb.isConfigured) {
      setSyncStatus('local');
      return;
    }
    setSyncStatus('syncing');
    try {
      const dbProfiles = await sb.getProfiles();
      if (dbProfiles && dbProfiles.length > 0) {
        const updated = { ...profiles };
        for (const p of dbProfiles) {
          const [completedLessons, notebook, savedSessions] = await Promise.all([
            sb.getProgress(p.id),
            sb.getVocabulary(p.id),
            sb.getSessions(p.id)
          ]);
          updated[p.id] = {
            ...updated[p.id],
            ...p,
            speech_rate: Number(p.speech_rate || 0.85),
            completedLessons: completedLessons || [],
            notebook: notebook || [],
            savedSessions: savedSessions || []
          };
        }
        setProfiles(updated);
        setSyncStatus('synced');
      }
    } catch (err) {
      console.warn('Error sincronizando con Supabase:', err);
      setSyncStatus('error');
    }
  };

  useEffect(() => {
    loadFromSupabase();
  }, [supabaseUrl, supabaseKey]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiThinking]);

  // ============================================================================
  // SÍNTESIS DE VOZ (MISMA VOZ SIEMPRE: EDGE NEURAL O VOZ ALEMANA DEL DISPOSITIVO)
  // ============================================================================
  const speakText = async (text, customRate = null) => {
    if (!text) return;
    const rateToUse = customRate || speechRate;

    // Detener cualquier audio previo
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    setIsSpeaking(true);

    // 1. Intentar primero con la Edge Function de Supabase (Conrad / Katja Neural)
    if (sb.isConfigured) {
      try {
        const audioUrl = await sb.fetchEdgeTTS(text, tutorId, rateToUse);
        if (audioUrl) {
          const audio = new Audio(audioUrl);
          audioPlayerRef.current = audio;
          audio.onended = () => setIsSpeaking(false);
          audio.onerror = () => setIsSpeaking(false);
          await audio.play();
          return;
        }
      } catch {
        // Si la Edge Function aún no está desplegada, pasa silenciosamente al motor nativo
      }
    }

    // 2. Respaldo automático: Voz única en alemán (de-DE) del dispositivo (sin mezclar voces)
    if (!('speechSynthesis' in window)) {
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    utterance.rate = rateToUse;

    const voices = window.speechSynthesis.getVoices();
    const germanVoices = voices.filter((v) => v.lang.startsWith('de'));

    if (germanVoices.length > 0) {
      if (tutorId === 'stefan') {
        const maleVoice = germanVoices.find((v) =>
          /markus|conrad|stefan|male|martin|klaus|google deutsch/i.test(v.name)
        );
        utterance.voice = maleVoice || germanVoices[0];
        utterance.pitch = 0.95;
      } else {
        const femaleVoice = germanVoices.find((v) =>
          /anna|katja|clara|female|helena|petra|hedda/i.test(v.name)
        );
        utterance.voice = femaleVoice || germanVoices[germanVoices.length - 1];
        utterance.pitch = 1.05;
      }
    }

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  // ============================================================================
  // GUARDAR CAMBIOS DE SWITCHES EN SUPABASE
  // ============================================================================
  const updateSwitchPreference = async (field, value) => {
    if (!activeProfileId) return;
    setProfiles((prev) => ({
      ...prev,
      [activeProfileId]: { ...prev[activeProfileId], [field]: value }
    }));
    if (sb.isConfigured) {
      await sb.updateProfile(activeProfileId, { [field]: value });
    }
  };

  // ============================================================================
  // MOTOR PEDAGÓGICO CON GEMINI API
  // ============================================================================
  const callGeminiTutor = async ({ userText, lesson, history, isInitial = false }) => {
    const tutorName = TUTORS[tutorId].name;
    const isStrict = correctionMode === 'strict';

    const systemInstruction = `
Eres ${tutorName}, un profesor y coach de alemán estilo Praktika AI que enseña a hablar alemán a adultos hispanohablantes (${activeProfile?.name || 'estudiante'}).
REGLA DE VOZ: Todo tu campo "spoken_response" será leído por una única voz alemana de principio a fin. Mantén las explicaciones en español claras y concisas y pronuncia las frases clave en alemán con naturalidad.

CONTEXTO DE LA SESIÓN ACTUAL:
- Título: ${lesson.title}
- Nivel: ${lesson.level}
- Escenario / Tema pedido por el alumno: ${lesson.scenario}
- Objetivos sugeridos: ${lesson.objectives.join(' | ')}
- Modo de corrección: ${
      isStrict
        ? 'PROFESOR ESTRICTO: Si el usuario comete un error gramatical o el micrófono transcribió otra palabra parecida por pronunciación (ej. "Bier" en vez de "vier"), corrígelo amablemente dentro de tu respuesta hablada y pídele que lo intente de nuevo.'
        : 'CHARLA FLUIDA: Prioriza continuar la conversación. Si hay errores menores, regístralos SOLO en la tarjeta visual "correction", sin frenar el audio.'
    }

REGLAS PEDAGÓGICAS:
1. En niveles iniciales (A1.0 / A1.1), usa andamiaje bilingüe: guía en español y haz que el alumno diga las partes en alemán paso a paso. Si el alumno pidió un tema específico (ej. números, trenes, trabajo), entra de lleno en ese tema sin rodeos.
2. NUNCA dejes al alumno colgado: termina siempre tu intervención con una pregunta clara o invitándolo a decir una frase concreta en alemán.
3. Proporciona SIEMPRE 3 "suggested_replies" (respuestas sugeridas en alemán con su traducción y pronunciación figurada para hispanohablantes) que respondan directamente a lo que acabas de plantear.

Responde EXCLUSIVAMENTE con un objeto JSON válido con esta estructura exacta:
{
  "spoken_response": "Lo que dices en voz alta (mezclando español y alemán según el nivel).",
  "german_focus": "La frase principal en alemán que acabas de usar o enseñar.",
  "spanish_translation": "Traducción al español de esa frase principal.",
  "correction": {
    "has_error": false,
    "user_said": "Lo que dijo el usuario",
    "better_german": "Forma correcta en alemán",
    "explanation": "Explicación directa de gramática o pronunciación en español"
  },
  "completed_objective_indexes": [0],
  "new_vocab": [
    { "german": "Palabra o frase", "spanish": "Significado", "phonetic": "Pronunciación figurada" }
  ],
  "suggested_replies": [
    { "german": "Opción 1 en alemán", "spanish": "Qué significa", "phonetic": "Cómo suena" },
    { "german": "Opción 2 en alemán", "spanish": "Qué significa", "phonetic": "Cómo suena" },
    { "german": "Opción 3 en alemán", "spanish": "Qué significa", "phonetic": "Cómo suena" }
  ]
}`;

    if (geminiKey && geminiKey.trim().length > 10) {
      try {
        const contents = [];
        history.forEach((msg) => {
          contents.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.rawText || msg.german_focus || msg.spoken_response }]
          });
        });

        contents.push({
          role: 'user',
          parts: [
            {
              text: isInitial
                ? `Inicia la sesión "${lesson.title}" saludando a ${activeProfile?.name} y proponiendo el primer ejercicio práctico sobre: ${lesson.scenario}.`
                : `El estudiante dijo por micrófono: "${userText}". Evalúa su respuesta y continúa la clase.`
            }
          ]
        });

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey.trim()}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemInstruction }] },
              contents,
              generationConfig: {
                temperature: 0.6,
                responseMimeType: 'application/json'
              }
            })
          }
        );

        if (response.ok) {
          const data = await response.json();
          const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawJson) return JSON.parse(rawJson);
        }
      } catch (err) {
        console.warn('Error llamando a Gemini API:', err);
      }
    }

    // Respuesta de respaldo si aún no ha pegado la Gemini API Key en ⚙️
    if (isInitial) {
      return {
        spoken_response: `Hallo ${activeProfile?.name || ''}! Soy ${tutorName}. Hoy vamos a practicar: "${lesson.title}". Escucha la primera frase en alemán y repítela con el micrófono: "${lesson.starterVocab?.[0]?.german || 'Guten Tag, wie geht es Ihnen?'}"`,
        german_focus: lesson.starterVocab?.[0]?.german || 'Guten Tag, wie geht es Ihnen?',
        spanish_translation: lesson.starterVocab?.[0]?.spanish || 'Buenas tardes, ¿cómo está usted?',
        correction: { has_error: false, user_said: '', better_german: '', explanation: '' },
        completed_objective_indexes: [],
        new_vocab: lesson.starterVocab ? [lesson.starterVocab[0]] : [],
        suggested_replies: [
          {
            german: `Guten Morgen ${tutorName}, ich heiße ${activeProfile?.name || 'Bernardo'}.`,
            spanish: `Buenos días ${tutorName}, me llamo ${activeProfile?.name || 'Bernardo'}.`,
            phonetic: `Gúten Mórguen ${tutorName}, ij jáise ${activeProfile?.name || 'Bernardo'}`
          },
          {
            german: 'Hallo! Freut mich sehr.',
            spanish: '¡Hola! Mucho gusto.',
            phonetic: 'Jálo! Fróit mij zéa'
          },
          {
            german: 'Können wir heute Zahlen üben?',
            spanish: '¿Podemos practicar números hoy?',
            phonetic: 'Kénen vía jóite tsálen üben?'
          }
        ]
      };
    }

    return {
      spoken_response: `Sehr gut! Escuché "${userText}". Para que esta sesión sea 100% libre y dinámica sobre cualquier tema, recuerda pegar tu Gemini API Key gratuita en el botón de configuración arriba a la derecha. ¿Continuamos con la siguiente frase?`,
      german_focus: 'Sehr gut! Machen wir weiter.',
      spanish_translation: '¡Muy bien! Sigamos adelante.',
      correction: {
        has_error: false,
        user_said: userText,
        better_german: userText,
        explanation: 'Activa tu llave gratuita de Gemini en el ícono de engranaje ⚙️ para recibir correcciones fonéticas y gramaticales en vivo.'
      },
      completed_objective_indexes: [0],
      new_vocab: [],
      suggested_replies: [
        { german: 'Ja, machen wir weiter!', spanish: '¡Sí, sigamos!', phonetic: 'Ya, májen vía váiter!' },
        { german: 'Noch einmal, bitte.', spanish: 'Una vez más, por favor.', phonetic: 'Nój áinmal, bíte.' },
        { german: 'Was bedeutet das?', spanish: '¿Qué significa eso?', phonetic: 'Vas bedóitet das?' }
      ]
    };
  };

  // ============================================================================
  // INICIAR O RETOMAR UNA SESIÓN (Y GUARDARLA EN klang_sessions)
  // ============================================================================
  const startLessonSession = async (lesson, existingSession = null) => {
    setActiveLesson(lesson);
    setCurrentView('session');

    // Si estamos retomando una sesión previa guardada en Supabase
    if (existingSession && existingSession.messages?.length > 0) {
      setActiveSessionId(existingSession.id);
      setMessages(existingSession.messages);
      const lastTutorMsg = [...existingSession.messages].reverse().find((m) => m.role === 'tutor');
      setSuggestedReplies(lastTutorMsg?.suggested_replies || []);
      setCompletedObjectives([]);
      setSessionVocabAdded([]);
      if (lastTutorMsg?.spoken_response) {
        speakText(lastTutorMsg.spoken_response);
      }
      return;
    }

    const newSessionId = crypto.randomUUID ? crypto.randomUUID() : `sess-${Date.now()}`;
    setActiveSessionId(newSessionId);
    setMessages([]);
    setCompletedObjectives([]);
    setSessionVocabAdded([]);
    setIsAiThinking(true);

    const aiResponse = await callGeminiTutor({
      userText: '',
      lesson,
      history: [],
      isInitial: true
    });

    const firstMsg = {
      id: Date.now(),
      role: 'tutor',
      spoken_response: aiResponse.spoken_response,
      german_focus: aiResponse.german_focus,
      spanish_translation: aiResponse.spanish_translation,
      suggested_replies: aiResponse.suggested_replies || [],
      rawText: aiResponse.spoken_response
    };

    const initialMessages = [firstMsg];
    setMessages(initialMessages);
    setSuggestedReplies(aiResponse.suggested_replies || []);
    setIsAiThinking(false);
    speakText(aiResponse.spoken_response);

    if (sb.isConfigured && activeProfileId) {
      const saved = await sb.saveSession({
        id: newSessionId,
        profile_id: activeProfileId,
        lesson_id: lesson.id,
        title: lesson.title,
        scenario_prompt: lesson.scenario,
        tutor_id: tutorId,
        messages: initialMessages
      });
      if (saved) {
        setProfiles((prev) => ({
          ...prev,
          [activeProfileId]: {
            ...prev[activeProfileId],
            savedSessions: [saved, ...(prev[activeProfileId].savedSessions || []).filter((s) => s.id !== saved.id)]
          }
        }));
      }
    }
  };

  // ============================================================================
  // PROCESAR TURNO HABLADO POR EL USUARIO
  // ============================================================================
  const handleSendUserTurn = async (spokenText) => {
    const cleanText = spokenText.trim();
    if (!cleanText || isAiThinking) return;

    const userMsg = {
      id: Date.now(),
      role: 'user',
      text: cleanText,
      rawText: cleanText
    };

    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setLiveTranscript('');
    setIsAiThinking(true);

    const aiResponse = await callGeminiTutor({
      userText: cleanText,
      lesson: activeLesson,
      history: updatedHistory,
      isInitial: false
    });

    const tutorMsg = {
      id: Date.now() + 1,
      role: 'tutor',
      spoken_response: aiResponse.spoken_response,
      german_focus: aiResponse.german_focus,
      spanish_translation: aiResponse.spanish_translation,
      correction: aiResponse.correction,
      suggested_replies: aiResponse.suggested_replies || [],
      rawText: aiResponse.spoken_response
    };

    const finalMessages = [...updatedHistory, tutorMsg];
    setMessages(finalMessages);
    setSuggestedReplies(aiResponse.suggested_replies || []);
    setIsAiThinking(false);

    // Actualizar objetivos completados
    if (Array.isArray(aiResponse.completed_objective_indexes)) {
      setCompletedObjectives((prev) =>
        Array.from(new Set([...prev, ...aiResponse.completed_objective_indexes]))
      );
    }

    // Guardar vocabulario nuevo en memoria y en Supabase (klang_vocabulary)
    if (Array.isArray(aiResponse.new_vocab) && aiResponse.new_vocab.length > 0 && activeProfileId) {
      const vocabWithLesson = aiResponse.new_vocab.map((v) => ({
        ...v,
        lessonId: activeLesson.id
      }));
      setSessionVocabAdded((prev) => [...prev, ...vocabWithLesson]);

      setProfiles((prev) => {
        const currentNotebook = prev[activeProfileId].notebook || [];
        const existingGerman = new Set(currentNotebook.map((i) => i.german.toLowerCase()));
        const filtered = vocabWithLesson.filter((v) => !existingGerman.has(v.german.toLowerCase()));
        return {
          ...prev,
          [activeProfileId]: {
            ...prev[activeProfileId],
            notebook: [...filtered, ...currentNotebook]
          }
        };
      });

      if (sb.isConfigured) {
        await sb.upsertVocabulary(activeProfileId, vocabWithLesson);
      }
    }

    // Actualizar historial de la sesión en Supabase (klang_sessions)
    if (sb.isConfigured && activeProfileId && activeSessionId) {
      await sb.saveSession({
        id: activeSessionId,
        profile_id: activeProfileId,
        lesson_id: activeLesson.id,
        title: activeLesson.title,
        scenario_prompt: activeLesson.scenario,
        tutor_id: tutorId,
        messages: finalMessages
      });
    }

    speakText(aiResponse.spoken_response);
  };

  // ============================================================================
  // RECONOCIMIENTO DE VOZ DEL TELÉFONO / NAVEGADOR (de-DE)
  // ============================================================================
  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Usa Chrome o Safari para activar el micrófono de voz en alemán.');
      return;
    }

    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (audioPlayerRef.current) audioPlayerRef.current.pause();
    setIsSpeaking(false);

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
        handleSendUserTurn(finalCollected.trim());
      }
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListeningAndSend = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    if (liveTranscript.trim().length > 0) {
      handleSendUserTurn(liveTranscript.trim());
    }
  };

  // ============================================================================
  // BOTÓN DE PÁNICO ("¿CÓMO DIGO...?")
  // ============================================================================
  const handleAskPanicHelper = async () => {
    if (!panicQuery.trim()) return;
    setIsPanicLoading(true);

    if (geminiKey && geminiKey.trim().length > 10) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey.trim()}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `El estudiante quiere saber cómo decir en alemán: "${panicQuery}". Devuelve SOLO un JSON con: {"german": "frase natural en alemán", "spanish": "significado", "phonetic": "pronunciación figurada para hispanohablantes", "tip": "nota breve de uso"}`
                    }
                  ]
                }
              ],
              generationConfig: { responseMimeType: 'application/json' }
            })
          }
        );
        if (res.ok) {
          const data = await res.json();
          const parsed = JSON.parse(data.candidates[0].content.parts[0].text);
          setPanicResult(parsed);
          setIsPanicLoading(false);
          speakText(parsed.german, 0.8);
          return;
        }
      } catch (e) {
        console.warn(e);
      }
    }

    setPanicResult({
      german: 'Können Sie mir bitte helfen?',
      spanish: panicQuery,
      phonetic: 'Kénen zi mía bíte jélfen?',
      tip: 'Configura tu Gemini API Key en el engranaje ⚙️ para traducir cualquier frase al instante.'
    });
    setIsPanicLoading(false);
  };

  const finishAndSaveLesson = async () => {
    if (activeLesson && activeProfileId) {
      setProfiles((prev) => {
        const currentCompleted = prev[activeProfileId].completedLessons || [];
        return {
          ...prev,
          [activeProfileId]: {
            ...prev[activeProfileId],
            completedLessons: Array.from(new Set([...currentCompleted, activeLesson.id]))
          }
        };
      });
      if (sb.isConfigured) {
        await sb.markLessonCompleted(activeProfileId, activeLesson.id);
      }
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setCurrentView('dashboard');
  };

  const saveCredentials = () => {
    localStorage.setItem('klang_sb_url', supabaseUrl.trim());
    localStorage.setItem('klang_sb_key', supabaseKey.trim());
    localStorage.setItem('klang_gemini_key', geminiKey.trim());
    setShowSettingsModal(false);
    loadFromSupabase();
  };

  // ============================================================================
  // VISTA 1: SELECCIÓN DE PERFIL (BERNARDO / CECI)
  // ============================================================================
  if (currentView === 'profile_select') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6 select-none">
        <header className="flex items-center justify-between max-w-md mx-auto w-full pt-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 via-red-500 to-slate-900 flex items-center justify-center font-black text-white shadow-lg">
              DE
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight leading-none">KlangDE</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    syncStatus === 'synced'
                      ? 'bg-emerald-400'
                      : syncStatus === 'syncing'
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-slate-500'
                  }`}
                />
                <p className="text-[11px] text-slate-400">
                  {syncStatus === 'synced'
                    ? 'Conectado a Supabase (klang_*)'
                    : 'Modo Local (Configura Supabase en ⚙️)'}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:border-slate-700"
          >
            <Settings className="w-4 h-4 text-amber-400" />
            <span>Conexiones</span>
          </button>
        </header>

        <main className="max-w-md mx-auto w-full my-auto py-8">
          <div className="text-center mb-8">
            <span className="inline-block px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-amber-400 font-medium mb-3">
              Práctica de Conversación Real
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">¿Quién va a practicar hoy?</h2>
            <p className="text-sm text-slate-400 mt-1">
              Cada perfil sincroniza su propio avance, sesiones libres y Cuaderno de Bolsillo en Supabase.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.values(profiles).map((profile) => (
              <button
                key={profile.id}
                onClick={() => {
                  setActiveProfileId(profile.id);
                  setTutorId(profile.preferred_tutor || 'stefan');
                  setSpeechRate(Number(profile.speech_rate || 0.85));
                  setMicMode(profile.mic_mode || 'ptt');
                  setCorrectionMode(profile.correction_mode || 'strict');
                  setCurrentView('dashboard');
                }}
                className="group relative overflow-hidden rounded-2xl bg-slate-900/90 border border-slate-800/90 p-5 text-left transition-all hover:border-slate-600 hover:bg-slate-900 active:scale-[0.99]"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${
                      profile.avatar_color || 'from-blue-600 to-indigo-700'
                    } flex items-center justify-center text-xl font-bold text-white shadow-md`}
                  >
                    {profile.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg text-white">{profile.name}</h3>
                    <p className="text-xs text-slate-400 truncate">{profile.current_level}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                        Tutor: {TUTORS[profile.preferred_tutor || 'stefan'].name}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">
                        {(profile.notebook || []).length} frases
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </main>

        <footer className="text-center text-xs text-slate-500 max-w-md mx-auto">
          Tablas activas: <code className="text-slate-400">klang_profiles</code> ·{' '}
          <code className="text-slate-400">klang_sessions</code> ·{' '}
          <code className="text-slate-400">klang_vocabulary</code>
        </footer>

        {showSettingsModal && (
          <CredentialsModal
            supabaseUrl={supabaseUrl}
            setSupabaseUrl={setSupabaseUrl}
            supabaseKey={supabaseKey}
            setSupabaseKey={setSupabaseKey}
            geminiKey={geminiKey}
            setGeminiKey={setGeminiKey}
            onSave={saveCredentials}
            onClose={() => setShowSettingsModal(false)}
          />
        )}
      </div>
    );
  }

  // ============================================================================
  // VISTA 2: DASHBOARD (TEMAS LIBRES AL PROFESOR + HISTORIAL + 7 SESIONES BASE)
  // ============================================================================
  if (currentView === 'dashboard' && activeProfile) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
        <header className="sticky top-0 z-20 backdrop-blur-md bg-slate-950/85 border-b border-slate-900 px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <button
              onClick={() => setCurrentView('profile_select')}
              className="flex items-center gap-2.5 text-left group"
            >
              <div
                className={`w-9 h-9 rounded-xl bg-gradient-to-br ${activeProfile.avatar_color} flex items-center justify-center font-bold text-sm text-white`}
              >
                {activeProfile.name[0]}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm">{activeProfile.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 group-hover:text-white">
                    Cambiar
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">{activeProfile.current_level}</p>
              </div>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentView('notebook')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-medium text-emerald-300 hover:border-emerald-700/60"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Cuaderno ({(activeProfile.notebook || []).length})</span>
              </button>
              <button
                onClick={() => setShowSettingsModal(true)}
                className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                title="Conexiones Supabase y Gemini"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 pt-5 space-y-6">
          {/* Preferencias rápidas de Tutor y Velocidad */}
          <section className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-11 h-11 rounded-xl bg-gradient-to-br ${activeTutor.accentColor} flex items-center justify-center text-white font-bold shadow`}
                >
                  {activeTutor.name[0]}
                </div>
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                    Tu Profesor Activo
                  </span>
                  <h3 className="font-bold text-sm text-white">
                    {activeTutor.name} · <span className="text-slate-400 font-normal">{activeTutor.role}</span>
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                {Object.values(TUTORS).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTutorId(t.id);
                      updateSwitchPreference('preferred_tutor', t.id);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      tutorId === t.id ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t.name} ({t.gender === 'male' ? 'H' : 'M'})
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* PROPONER UN TEMA AL PROFESOR EN EL ACTO */}
          <section className="rounded-2xl bg-gradient-to-br from-indigo-950/70 via-slate-900 to-slate-900 border border-indigo-800/50 p-4 shadow-lg">
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="font-bold text-sm text-white">Proponerle un tema hoy a {activeTutor.name}</h3>
            </div>
            <p className="text-xs text-slate-300 mb-3">
              Pídele lo que quieras practicar hoy y se guardará en tu historial de conversaciones:
            </p>

            {/* Chips de ideas rápidas */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {[
                'Hoy quiero practicar los números del 1 al 100',
                'Conversación comprando pasajes de tren',
                'Practicar los días de la semana y horas',
                'Simular pedir comida en un restaurante'
              ].map((idea) => (
                <button
                  key={idea}
                  onClick={() => setCustomTopicInput(idea)}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-700/80 text-slate-300 hover:border-indigo-500 hover:text-white transition"
                >
                  {idea}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={customTopicInput}
                onChange={(e) => setCustomTopicInput(e.target.value)}
                placeholder="Ej: Hoy me gustaría practicar una conversación sobre trenes..."
                className="flex-1 rounded-xl bg-slate-950/90 border border-slate-800 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={() => {
                  if (!customTopicInput.trim()) return;
                  const topic = customTopicInput.trim();
                  setCustomTopicInput('');
                  startLessonSession({
                    id: `custom-${Date.now()}`,
                    title: topic,
                    level: activeProfile.current_level,
                    scenario: `El estudiante propuso este objetivo para la clase de hoy: "${topic}". Enséñale desde la base las palabras o números necesarios y guíalo en una conversación práctica paso a paso.`,
                    objectives: [
                      'Aprender el vocabulario clave del tema propuesto',
                      'Pronunciar al menos 3 frases completas',
                      'Resolver una situación práctica con el profesor'
                    ]
                  });
                }}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shrink-0 transition"
              >
                Iniciar Clase
              </button>
            </div>
          </section>

          {/* CONVERSACIONES ABIERTAS GUARDADAS EN SUPABASE (klang_sessions) */}
          {(activeProfile.savedSessions || []).length > 0 && (
            <section className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-sky-400" />
                  <h3 className="font-bold text-sm text-white">Retomar Conversaciones Anteriores</h3>
                </div>
                <span className="text-[11px] text-slate-400">Guardadas en Supabase</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {activeProfile.savedSessions.slice(0, 4).map((sess) => (
                  <button
                    key={sess.id}
                    onClick={() =>
                      startLessonSession(
                        {
                          id: sess.lesson_id,
                          title: sess.title,
                          level: activeProfile.current_level,
                          scenario: sess.scenario_prompt || sess.title,
                          objectives: ['Continuar conversación guardada', 'Practicar pronunciación']
                        },
                        sess
                      )
                    }
                    className="rounded-xl bg-slate-900/80 border border-slate-800/90 hover:border-sky-500/50 p-3 text-left transition flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <h4 className="font-semibold text-xs text-white truncate">{sess.title}</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {(sess.messages || []).length} intervenciones · Tutor:{' '}
                        {TUTORS[sess.tutor_id || 'stefan']?.name}
                      </p>
                    </div>
                    <MessageSquare className="w-4 h-4 text-sky-400 shrink-0" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* LAS 7 SESIONES BASE DEL CURRÍCULO */}
          <div className="space-y-5">
            {CURRICULUM.map((module) => {
              const IconComponent = module.icon;
              return (
                <section key={module.id} className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <IconComponent className="w-4 h-4 text-amber-400" />
                    <h2 className="font-bold text-sm text-white">{module.title}</h2>
                  </div>
                  <p className="text-xs text-slate-400 -mt-1">{module.description}</p>

                  <div className="space-y-2.5">
                    {module.lessons.map((lesson) => {
                      const isDone = (activeProfile.completedLessons || []).includes(lesson.id);
                      return (
                        <div
                          key={lesson.id}
                          className="rounded-2xl bg-slate-900 border border-slate-800/90 p-4 flex items-center justify-between gap-4 hover:border-slate-700 transition"
                        >
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-800 text-amber-400">
                                Sesión {lesson.id} · {lesson.level}
                              </span>
                              {isDone && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Completada
                                </span>
                              )}
                            </div>
                            <h3 className="font-bold text-sm text-white">{lesson.title}</h3>
                            <p className="text-xs text-slate-400 line-clamp-2">{lesson.scenario}</p>
                          </div>

                          <button
                            onClick={() => startLessonSession(lesson)}
                            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center gap-1.5 shrink-0 shadow"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Practicar</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </main>

        {showSettingsModal && (
          <CredentialsModal
            supabaseUrl={supabaseUrl}
            setSupabaseUrl={setSupabaseUrl}
            supabaseKey={supabaseKey}
            setSupabaseKey={setSupabaseKey}
            geminiKey={geminiKey}
            setGeminiKey={setGeminiKey}
            onSave={saveCredentials}
            onClose={() => setShowSettingsModal(false)}
          />
        )}
      </div>
    );
  }

  // ============================================================================
  // VISTA 3: CUADERNO DE BOLSILLO (SINCRONIZADO CON klang_vocabulary)
  // ============================================================================
  if (currentView === 'notebook' && activeProfile) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
        <header className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur border-b border-slate-900 px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <button
              onClick={() => setCurrentView('dashboard')}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Volver a las Rutas</span>
            </button>
            <h2 className="font-bold text-sm">Cuaderno de {activeProfile.name}</h2>
            <span className="text-xs text-emerald-400 font-semibold">
              {(activeProfile.notebook || []).length} frases
            </span>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 pt-5 space-y-3">
          {(activeProfile.notebook || []).map((item, idx) => (
            <div
              key={`${item.german}-${idx}`}
              className="rounded-2xl bg-slate-900 border border-slate-800 p-4 flex items-center justify-between gap-3"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base text-white">{item.german}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                    {item.lesson_id || item.lessonId || 'Sesión'}
                  </span>
                </div>
                <p className="text-xs text-emerald-300 font-medium">{item.spanish}</p>
                {item.phonetic && (
                  <p className="text-[11px] text-slate-400 italic">Suena: [{item.phonetic}]</p>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => speakText(item.german, 0.75)}
                  className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-amber-300 font-semibold"
                  title="Escuchar lento (0.75x)"
                >
                  🐢
                </button>
                <button
                  onClick={() => speakText(item.german, 1.0)}
                  className="p-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/30"
                  title="Escuchar normal"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
                <button
                  onClick={async () => {
                    setProfiles((prev) => ({
                      ...prev,
                      [activeProfileId]: {
                        ...prev[activeProfileId],
                        notebook: prev[activeProfileId].notebook.filter((w) => w.german !== item.german)
                      }
                    }));
                    if (sb.isConfigured) {
                      await sb.deleteVocabularyItem(activeProfileId, item.german);
                    }
                  }}
                  className="p-2.5 rounded-xl text-slate-500 hover:text-rose-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </main>
      </div>
    );
  }

  // ============================================================================
  // VISTA 4: SALA DE PRÁCTICA EN VIVO
  // ============================================================================
  return (
    <div className="h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden select-none">
      {/* Barra superior con los Switches sincronizados a klang_profiles */}
      <header className="bg-slate-900/95 border-b border-slate-800 px-3 py-2 shrink-0">
        <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={finishAndSaveLesson}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="font-bold text-xs sm:text-sm text-white line-clamp-1">
                {activeLesson?.title}
              </h2>
              <p className="text-[10px] text-slate-400">
                Tutor: <strong className="text-slate-200">{activeTutor.name}</strong> (Misma voz continua)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Switch Tutor */}
            <button
              onClick={() => {
                const next = tutorId === 'stefan' ? 'clara' : 'stefan';
                setTutorId(next);
                updateSwitchPreference('preferred_tutor', next);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-semibold text-slate-200"
            >
              👤 {activeTutor.name}
            </button>

            {/* Switch Velocidad */}
            <button
              onClick={() => {
                const nextRate = speechRate === 0.75 ? 0.85 : speechRate === 0.85 ? 1.0 : 0.75;
                setSpeechRate(nextRate);
                updateSwitchPreference('speech_rate', nextRate);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-semibold text-amber-300"
            >
              🐢 {speechRate}x
            </button>

            {/* Switch Estricto vs Fluido */}
            <button
              onClick={() => {
                const nextMode = correctionMode === 'strict' ? 'fluid' : 'strict';
                setCorrectionMode(nextMode);
                updateSwitchPreference('correction_mode', nextMode);
              }}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 ${
                correctionMode === 'strict'
                  ? 'bg-amber-950/70 border-amber-700/70 text-amber-300'
                  : 'bg-emerald-950/70 border-emerald-700/70 text-emerald-300'
              }`}
            >
              {correctionMode === 'strict' ? (
                <>
                  <ShieldAlert className="w-3 h-3" /> Estricto
                </>
              ) : (
                <>
                  <Zap className="w-3 h-3" /> Fluido
                </>
              )}
            </button>

            {/* Switch Walkie-Talkie vs Manos Libres */}
            <button
              onClick={() => {
                const nextMic = micMode === 'ptt' ? 'auto' : 'ptt';
                setMicMode(nextMic);
                updateSwitchPreference('mic_mode', nextMic);
              }}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 ${
                micMode === 'ptt'
                  ? 'bg-indigo-950/80 border-indigo-700/70 text-indigo-300'
                  : 'bg-teal-950/80 border-teal-700/70 text-teal-300'
              }`}
            >
              <Radio className="w-3 h-3" />
              {micMode === 'ptt' ? 'Walkie-Talkie' : 'Fluido'}
            </button>
          </div>
        </div>
      </header>

      {/* Zona superior: Orbe de Audio Reactivo + Objetivos */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-900 px-4 py-3 shrink-0">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                const lastTutor = [...messages].reverse().find((m) => m.role === 'tutor');
                if (lastTutor) speakText(lastTutor.spoken_response);
              }}
              className={`relative w-14 h-14 rounded-full bg-gradient-to-br ${activeTutor.accentColor} flex items-center justify-center shadow-xl ring-4 ${activeTutor.ringColor} transition-transform ${
                isSpeaking ? 'scale-105' : ''
              }`}
            >
              <div className="flex items-end gap-1 h-5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className={`w-1 rounded-full bg-white transition-all duration-150 ${
                      isSpeaking
                        ? i % 2 === 0
                          ? 'h-5 animate-bounce'
                          : 'h-3 animate-pulse'
                        : isListening
                        ? 'h-4 bg-rose-200 animate-ping'
                        : 'h-1.5 opacity-80'
                    }`}
                  />
                ))}
              </div>
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">{activeTutor.name}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                    isSpeaking
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                      : isListening
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : isAiThinking
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {isSpeaking
                    ? 'Hablando...'
                    : isListening
                    ? 'Escuchándote en alemán...'
                    : isAiThinking
                    ? 'Evaluando...'
                    : 'Listo para escucharte'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Toca el círculo para volver a escuchar a {activeTutor.name}.
              </p>
            </div>
          </div>

          <div className="flex sm:flex-col gap-1.5 w-full sm:w-auto overflow-x-auto">
            {activeLesson?.objectives?.map((obj, index) => {
              const done = completedObjectives.includes(index);
              return (
                <div
                  key={index}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] border shrink-0 ${
                    done
                      ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
                      : 'bg-slate-900/90 border-slate-800 text-slate-400'
                  }`}
                >
                  <CheckCircle2 className={`w-3.5 h-3.5 ${done ? 'text-emerald-400' : 'text-slate-600'}`} />
                  <span className="truncate max-w-[200px]">{obj}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Historial Bilingüe en Vivo */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 max-w-3xl mx-auto w-full">
        {messages.map((msg) => {
          if (msg.role === 'user') {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[82%] rounded-2xl rounded-tr-sm bg-indigo-600 text-white px-4 py-2.5 shadow">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{msg.text}</p>
                    <button
                      onClick={() => speakText(msg.text, 0.9)}
                      className="p-1 rounded-lg bg-indigo-700/80 hover:bg-indigo-800 text-indigo-200"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className="space-y-2">
              {msg.correction && (msg.correction.has_error || msg.correction.explanation) && (
                <div
                  className={`rounded-xl p-3 border text-xs ${
                    msg.correction.has_error
                      ? 'bg-amber-950/40 border-amber-700/60 text-amber-200'
                      : 'bg-emerald-950/30 border-emerald-800/50 text-emerald-200'
                  }`}
                >
                  <div className="font-bold mb-1">
                    {msg.correction.has_error
                      ? '🎯 Ajuste del Profesor:'
                      : '✅ Retroalimentación del Profesor:'}
                  </div>
                  {msg.correction.better_german && (
                    <div className="flex items-center justify-between gap-2 bg-slate-950/60 rounded-lg px-2.5 py-1.5 mb-1">
                      <div>
                        <span className="text-slate-400">Forma ideal: </span>
                        <strong className="text-white">{msg.correction.better_german}</strong>
                      </div>
                      <button
                        onClick={() => speakText(msg.correction.better_german, 0.75)}
                        className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-amber-300"
                      >
                        🐢 Escuchar
                      </button>
                    </div>
                  )}
                  <p className="text-[11px] text-slate-300">{msg.correction.explanation}</p>
                </div>
              )}

              <div className="flex justify-start">
                <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-slate-900 border border-slate-800 p-3.5 space-y-2 shadow">
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                    {msg.spoken_response}
                  </p>

                  {msg.german_focus && (
                    <div className="rounded-xl bg-slate-950 border border-slate-800/90 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-sm sm:text-base text-amber-300">
                          {msg.german_focus}
                        </p>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => speakText(msg.german_focus, 0.75)}
                            className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-[11px] text-slate-300"
                          >
                            🐢 0.75x
                          </button>
                          <button
                            onClick={() => speakText(msg.german_focus, speechRate)}
                            className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30"
                          >
                            <Volume2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {msg.spanish_translation && (
                        <p className="text-xs text-slate-400 mt-1">{msg.spanish_translation}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        <div ref={chatEndRef} />
      </div>

      {/* Andamiaje en Vivo + Botón de Micrófono */}
      <footer className="bg-slate-900/95 border-t border-slate-800 px-3 pt-2.5 pb-4 shrink-0">
        <div className="max-w-3xl mx-auto space-y-2.5">
          {suggestedReplies.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  💡 Sugerencias para leer en voz alta (o di tu propia respuesta):
                </span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {suggestedReplies.map((reply, i) => (
                  <div
                    key={i}
                    className="min-w-[230px] max-w-[270px] rounded-xl bg-slate-950 border border-slate-800 p-2.5 flex flex-col justify-between shrink-0"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1.5">
                        <p className="font-bold text-xs text-white leading-snug">{reply.german}</p>
                        <button
                          onClick={() => speakText(reply.german, 0.8)}
                          className="p-1 rounded bg-slate-800 text-amber-300 hover:bg-slate-700 shrink-0"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-[11px] text-emerald-400 mt-0.5">{reply.spanish}</p>
                    </div>
                    <div className="mt-1.5 pt-1.5 border-t border-slate-900 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-400 italic truncate">
                        [{reply.phonetic}]
                      </span>
                      <button
                        onClick={() => handleSendUserTurn(reply.german)}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60 hover:bg-indigo-900 shrink-0"
                      >
                        Probar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {liveTranscript && (
            <div className="rounded-xl bg-slate-950 border border-rose-500/40 px-3 py-1.5 flex items-center justify-between">
              <p className="text-xs text-white">
                <span className="text-rose-400 font-semibold mr-1.5">Escuchado:</span>"{liveTranscript}"
              </p>
              <button
                onClick={() => setLiveTranscript('')}
                className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Borrar
              </button>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              onClick={() => {
                setPanicResult(null);
                setPanicQuery('');
                setShowPanicModal(true);
              }}
              className="px-3 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-amber-300 flex items-center gap-1.5 shrink-0"
            >
              <HelpCircle className="w-4 h-4" />
              <span>¿Cómo digo...?</span>
            </button>

            {micMode === 'ptt' ? (
              <button
                onClick={() => (isListening ? stopListeningAndSend() : startListening())}
                disabled={isAiThinking}
                className={`flex-1 py-3.5 px-5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 shadow-lg transition-all ${
                  isListening
                    ? 'bg-rose-600 hover:bg-rose-500 text-white ring-4 ring-rose-500/30 animate-pulse'
                    : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white'
                }`}
              >
                <Mic className="w-5 h-5" />
                <span>
                  {isListening
                    ? 'Toca para Enviar al Profesor'
                    : 'Toca para Hablar (Walkie-Talkie)'}
                </span>
              </button>
            ) : (
              <button
                onClick={() => (isListening ? stopListeningAndSend() : startListening())}
                disabled={isAiThinking}
                className={`flex-1 py-3.5 px-5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 shadow-lg transition-all ${
                  isListening
                    ? 'bg-teal-600 text-white ring-4 ring-teal-500/30'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                <Radio className="w-5 h-5" />
                <span>
                  {isListening ? 'Escuchando en vivo (Envío automático)...' : 'Iniciar Micrófono Fluido'}
                </span>
              </button>
            )}

            <button
              onClick={finishAndSaveLesson}
              className="px-3 py-3 rounded-2xl bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-700/60 text-xs font-bold text-emerald-300 shrink-0"
            >
              Cerrar ({sessionVocabAdded.length})
            </button>
          </div>
        </div>
      </footer>

      {/* Modal Botón de Pánico */}
      {showPanicModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base">Salvavidas: ¿Cómo digo en alemán...?</h3>
              </div>
              <button
                onClick={() => setShowPanicModal(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cerrar
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={panicQuery}
                onChange={(e) => setPanicQuery(e.target.value)}
                placeholder="Ej: ¿Cómo digo que quiero pagar con tarjeta?"
                className="flex-1 rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              />
              <button
                onClick={handleAskPanicHelper}
                disabled={isPanicLoading}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
              >
                {isPanicLoading ? '...' : 'Traducir'}
              </button>
            </div>

            {panicResult && (
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-base text-amber-300">{panicResult.german}</p>
                  <button
                    onClick={() => speakText(panicResult.german, 0.8)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 text-xs text-white flex items-center gap-1"
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

// ============================================================================
// MODAL DE CREDENCIALES (SUPABASE URL/KEY + GEMINI KEY)
// ============================================================================
function CredentialsModal({
  supabaseUrl,
  setSupabaseUrl,
  supabaseKey,
  setSupabaseKey,
  geminiKey,
  setGeminiKey,
  onSave,
  onClose
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base text-white">Conexión a Supabase y Gemini</h3>
          </div>
          <button onClick={onClose} className="text-xs text-slate-400 hover:text-white">
            Cerrar
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              1. Supabase Project URL (donde corriste las tablas klang_*)
            </label>
            <input
              type="text"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              placeholder="https://xxxxxxxxxxxx.supabase.co"
              className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              2. Supabase Anon Public Key
            </label>
            <input
              type="password"
              value={supabaseKey}
              onChange={(e) => setSupabaseKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
              className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              3. Gemini API Key (Gratuita en aistudio.google.com)
            </label>
            <input
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-300"
          >
            Cancelar
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" /> Guardar y Sincronizar
          </button>
        </div>
      </div>
    </div>
  );
}
