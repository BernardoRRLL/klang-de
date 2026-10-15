import { TUTORS } from '../data/curriculum';

const GEMINI_API_KEY = (import.meta.env.VITE_GEMINI_API_KEY || '').trim();

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
                temperature: 0.3, // Reducido para mayor velocidad y determinismo
                responseMimeType: 'application/json'
              }
            })
          }
        );

        if (res.status === 503 || res.status === 429) {
          await new Promise((r) => setTimeout(r, 400));
          continue;
        }

        if (!res.ok) {
          const errText = await res.text();
          lastError = new Error(`${modelName}: ${res.status} - ${errText}`);
          break;
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

  throw lastError || new Error('Saturación en los servidores de IA.');
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
  if (!GEMINI_API_KEY) throw new Error('Falta VITE_GEMINI_API_KEY');

  const tutorName = TUTORS[tutorId]?.name || 'Stefan';

  // PROMPT OPTIMIZADO: JSON plano, directo y fácil de procesar para Llama 3 o Gemini Flash
  const systemPrompt = `Eres ${tutorName}, profesor de alemán de ${studentName}.
Tema: "${lesson.title}". Escenario: ${lesson.scenario}. Modo: ${correctionMode === 'strict' ? 'Estricto' : 'Fluido'}.

REGLA ABSOLUTA: Responde SOLO con un objeto JSON plano. Separa estrictamente tu explicación en español de tu frase en alemán.
Estructura obligatoria:
{
  "spanish_text": "Tu comentario, explicación o saludo en español nativo",
  "german_text": "La frase principal en alemán nativo",
  "has_error": false,
  "correction_es": "Si cometió un error, explícalo brevemente aquí en español (o vacío)",
  "correction_de": "La corrección exacta en alemán (o vacío)",
  "suggestions": [
    {"de": "Opción 1 en alemán", "es": "Traducción 1"},
    {"de": "Opción 2 en alemán", "es": "Traducción 2"}
  ]
}`;

  const contents = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: '{"spanish_text": "Entendido.", "german_text": "Verstanden.", "has_error": false, "correction_es": "", "correction_de": "", "suggestions": []}' }] }
  ];

  history.slice(-4).forEach((msg) => {
    contents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      // Adaptado al nuevo formato para mantener contexto
      parts: [{ text: msg.rawText || msg.text || `${msg.spanish_text} ${msg.german_text}` }]
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
  const contents = [{
    role: 'user',
    parts: [{ text: `Traduce al alemán: "${query}". Devuelve SOLO JSON: {"german": "...", "spanish": "...", "phonetic": "...", "tip": "..."}` }]
  }];
  return callModelWithFallback(contents);
}
