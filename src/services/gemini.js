import { TUTORS } from '../data/curriculum';

const GEMINI_API_KEY = (import.meta.env.VITE_GEMINI_API_KEY || '').trim();

// Cascada de modelos actuales de Google ordenados por velocidad y estabilidad
const MODELS_CASCADING = [
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
  'gemini-flash'
];

async function callModelWithFallback(contents) {
  let lastError = null;

  for (const modelName of MODELS_CASCADING) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`,
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

        // Si hay alta demanda o límite temporal, reintentar o pasar al siguiente modelo
        if (res.status === 503 || res.status === 429) {
          await new Promise((r) => setTimeout(r, 400));
          continue;
        }

        if (!res.ok) {
          const errText = await res.text();
          lastError = new Error(`${modelName}: ${res.status} - ${errText}`);
          break; // Probar el siguiente modelo de la lista
        }

        const data = await res.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
          return JSON.parse(cleaned);
        }
      } catch (err) {
        lastError = err;
      }
    }
  }

  throw lastError || new Error('Los servidores de Google están saturados temporalmente. Inténtalo de nuevo.');
}

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

  const contents = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: 'Entendido. Comenzamos la sesión.' }] }
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

  return callModelWithFallback(contents);
}

export async function translatePanicQuery(query) {
  if (!GEMINI_API_KEY) throw new Error('Falta API Key');

  const contents = [
    {
      role: 'user',
      parts: [
        {
          text: `Traduce al alemán: "${query}". Devuelve SOLO un JSON: {"german": "...", "spanish": "...", "phonetic": "...", "tip": "..."}`
        }
      ]
    }
  ];

  return callModelWithFallback(contents);
}
