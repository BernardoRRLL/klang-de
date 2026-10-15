import { TUTORS } from '../data/curriculum';

const GEMINI_API_KEY = (import.meta.env.VITE_GEMINI_API_KEY || '').trim();
const MODELS_TO_TRY = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

async function requestGeminiJSON(promptText) {
  if (!GEMINI_API_KEY) {
    throw new Error('Falta VITE_GEMINI_API_KEY en GitHub Secrets');
  }

  let lastError = null;

  for (const modelName of MODELS_TO_TRY) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: promptText }] }],
            generationConfig: {
              temperature: 0.65,
              responseMimeType: 'application/json'
            }
          })
        }
      );

      if (!res.ok) {
        const errBody = await res.text();
        lastError = new Error(`Modelo ${modelName}: ${res.status} - ${errBody}`);
        continue;
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

  throw lastError || new Error('No se pudo conectar con Gemini API');
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
  const tutorName = TUTORS[tutorId]?.name || 'Stefan';
  const userTurnCount = history.filter((m) => m.role === 'user').length;

  const recentConversation = history
    .slice(-8)
    .map((m) => `${m.role === 'user' ? 'Alumno' : tutorName}: ${m.rawText || m.text || m.spoken_response}`)
    .join('\n');

  const prompt = `
Eres ${tutorName}, un profesor y coach privado de alemán estilo Praktika AI enseñándole a ${studentName}.
REGLA DE AUDIO: Tu campo "spoken_response" será leído de corrido por una única voz alemana. Sé cálido, conciso y natural.

DATOS DE LA SESIÓN:
- Tema: "${lesson.title}" (${lesson.level})
- Situación: ${lesson.scenario}
- Objetivos de la lección (índices 0, 1, 2):
  0: ${lesson.objectives?.[0] || 'Practicar vocabulario'}
  1: ${lesson.objectives?.[1] || 'Construir frases'}
  2: ${lesson.objectives?.[2] || 'Mantener la conversación'}
- Intervenciones actuales del alumno en esta sesión: ${userTurnCount} de mínimo 6 recomendadas.
- Modo de corrección: ${
    correctionMode === 'strict'
      ? 'ESTRICTO: Si hay errores de gramática o pronunciación, corrígelos amablemente en tu audio y haz que repita.'
      : 'FLUIDO: Prioriza la charla natural; deja las correcciones técnicas en el objeto "correction".'
  }

REGLA DE PROGRESO (MUY IMPORTANTE):
- NO des por completados todos los objetivos de golpe. Lleva la clase paso a paso.
- Solo incluye en "completed_objective_indexes" el índice (0, 1 o 2) que el alumno REALMENTE acaba de demostrar en este turno.

HISTORIAL RECIENTE:
${recentConversation || '(Inicio de la sesión)'}

${
  isInitial
    ? `INSTRUCCIÓN ACTUAL: Inicia la sesión saludando a ${studentName}, preséntale brevemente el reto de hoy ("${lesson.title}") y hazle la primera pregunta o ejercicio práctico.`
    : `INSTRUCCIÓN ACTUAL: El alumno acaba de decir por micrófono: "${userText}". Evalúa lo que dijo, corrígelo si aplica y continúa la conversación haciéndole la siguiente pregunta para que siga hablando.`
}

Devuelve EXCLUSIVAMENTE un JSON válido con esta estructura exacta:
{
  "spoken_response": "Lo que tú le dices hablándole directamente (mezclando español y alemán según su nivel)",
  "german_focus": "La frase clave en alemán que estás enseñando o usando en este turno",
  "spanish_translation": "Traducción al español de german_focus",
  "correction": {
    "has_error": false,
    "user_said": "${isInitial ? '' : userText.replace(/"/g, "'")}",
    "better_german": "Frase corregida en alemán (o vacío si estuvo perfecto)",
    "explanation": "Explicación breve en español de qué mejorar o felicitación puntual"
  },
  "completed_objective_indexes": [],
  "new_vocab": [
    { "german": "Frase o palabra clave", "spanish": "Significado", "phonetic": "Pronunciación figurada" }
  ],
  "suggested_replies": [
    { "german": "Respuesta sugerida 1 en alemán", "spanish": "Traducción", "phonetic": "Pronunciación figurada" },
    { "german": "Respuesta sugerida 2 en alemán", "spanish": "Traducción", "phonetic": "Pronunciación figurada" },
    { "german": "Respuesta sugerida 3 en alemán", "spanish": "Traducción", "phonetic": "Pronunciación figurada" }
  ]
}`;

  return requestGeminiJSON(prompt);
}

export async function translatePanicQuery(query) {
  const prompt = `El alumno en mitad de su clase de alemán pregunta: "¿Cómo digo en alemán: ${query}?".
Devuelve EXCLUSIVAMENTE un JSON válido con esta estructura:
{
  "german": "Frase natural en alemán",
  "spanish": "Significado exacto",
  "phonetic": "Pronunciación figurada fácil para un chileno/hispanohablante",
  "tip": "Consejo corto de pronunciación o uso"
}`;
  return requestGeminiJSON(prompt);
}