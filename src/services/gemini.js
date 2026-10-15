import { TUTORS } from '../data/curriculum';

const GEMINI_API_KEY = (import.meta.env.VITE_GEMINI_API_KEY || '').trim();
const MODEL_NAME = 'gemini-3.8-flash';

export async function generateTutorTurn({
  userText,
  lesson,
  history,
  tutorId,
  correctionMode,
  studentName,
  isInitial = false
}) {
  if (!GEMINI_API_KEY) {
    throw new Error('Falta VITE_GEMINI_API_KEY en GitHub Secrets');
  }

  const tutorName = TUTORS[tutorId]?.name || 'Stefan';

  // Prompt optimizado y ligero para respuesta ultrarrápida
  const systemPrompt = `Eres ${tutorName}, un profesor de alemán estilo Praktika AI enseñándole a ${studentName}.
Tema actual: "${lesson.title}". Situación: ${lesson.scenario}.
Modo de corrección: ${correctionMode === 'strict' ? 'Estricto' : 'Fluido'}.

Debes responder SIEMPRE en formato JSON estricto con esta estructura exacta (sin markdown extra, solo el objeto JSON):
{
  "spoken_response": "Lo que le dices en voz alta al alumno en español/alemán",
  "german_focus": "La frase clave en alemán principal de este turno",
  "spanish_translation": "Traducción al español",
  "correction": {
    "has_error": false,
    "better_german": "",
    "explanation": ""
  },
  "completed_objective_indexes": [],
  "new_vocab": [{"german": "", "spanish": "", "phonetic": ""}],
  "suggested_replies": [
    {"german": "...", "spanish": "...", "phonetic": "..."},
    {"german": "...", "spanish": "...", "phonetic": "..."},
    {"german": "...", "spanish": "...", "phonetic": "..."}
  ]
}`;

  // Mantener solo los últimos 4 mensajes para evitar latencia alta
  const contents = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: 'Entendido. Comenzamos la sesión de práctica conversacional.' }] }
  ];

  history.slice(-4).forEach((msg) => {
    contents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.rawText || msg.text || msg.spoken_response || '' }]
    });
  });

  if (!isInitial) {
    contents.push({ role: 'user', parts: [{ text: `El alumno dijo: "${userText}"` }] });
  } else {
    contents.push({ role: 'user', parts: [{ text: `Inicia la clase saludando y proponiendo el primer ejercicio.` }] });
  }

  // Petición optimizada con reintento único por alta demanda
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            generationConfig: {
              temperature: 0.5,
              responseMimeType: 'application/json'
            }
          })
        }
      );

      if (res.status === 503 || res.status === 429) {
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Error ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
        return JSON.parse(cleaned);
      }
    } catch (err) {
      if (attempt === 2) throw err;
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  throw new Error('Servidores con alta demanda. Intenta de nuevo.');
}

export async function translatePanicQuery(query) {
  if (!GEMINI_API_KEY) throw new Error('Falta API Key');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Traduce al alemán: "${query}". Devuelve SOLO un JSON: {"german": "...", "spanish": "...", "phonetic": "...", "tip": "..."}`
              }
            ]
          }
        ],
        generationConfig: { responseMimeType: 'application/json' }
      })
    }
  );

  const data = await res.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return JSON.parse(rawText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim());
}
