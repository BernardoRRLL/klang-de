import { TUTORS } from '../data/curriculum';

const GROQ_API_KEY = (import.meta.env.VITE_GROQ_API_KEY || '').trim();

// Cascada de modelos para alta disponibilidad
const GROQ_MODELS = [
  'openai/gpt-oss-120b',
  'mixtral-8x7b-32768',
  'gemma2-9b-it'
];

async function callGroqWithFallback(messages) {
  let lastError = null;

  for (const modelName of GROQ_MODELS) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelName,
          messages: messages,
          temperature: 0.3,
          response_format: { type: "json_object" }
        })
      });

      // Si el modelo fue dado de baja (404) o no es compatible (400), forzamos el salto
      if (res.status === 404 || res.status === 400) {
        const errText = await res.text();
        lastError = new Error(`${modelName} falló: ${res.status} - ${errText}`);
        continue; 
      }

      if (!res.ok) {
        const errText = await res.text();
        // Si el error es de autorización (401), la clave está mal y no tiene sentido iterar
        if (res.status === 401) {
            throw new Error(`Error de API Key (401). Verifica VITE_GROQ_API_KEY.`);
        }
        throw new Error(`Error de red con ${modelName}: ${res.status} - ${errText}`);
      }

      const data = await res.json();
      const rawText = data.choices[0].message.content;
      const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      return JSON.parse(cleaned);

    } catch (err) {
      lastError = err;
      // Rompemos el ciclo si es un error crítico de autorización
      if (err.message.includes('401')) throw err;
    }
  }

  throw lastError || new Error('Todos los modelos de la cascada fallaron o están descontinuados.');
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
  if (!GROQ_API_KEY) throw new Error('Falta VITE_GROQ_API_KEY en GitHub Secrets');

  const tutorName = TUTORS[tutorId]?.name || 'Stefan';

  // PROMPT ACTUALIZADO: Reglas estrictas de nivel A1 y tolerancia a la transcripción de voz
  const systemPrompt = `Eres ${tutorName}, profesor de alemán de ${studentName}.
Tema: "${lesson.title}". Escenario: ${lesson.scenario}. Modo: ${correctionMode === 'strict' ? 'Estricto' : 'Fluido'}.

REGLAS PEDAGÓGICAS ABSOLUTAS:
1. NIVEL A1 (PRINCIPIANTE): Tus frases en alemán DEBEN ser extremadamente simples, directas y cortas (máximo 1 o 2 líneas). NO uses oraciones compuestas, gramática compleja ni vocabulario avanzado.
2. TOLERANCIA DE TRANSCRIPCIÓN: El texto del alumno es generado por reconocimiento de voz. IGNORA TOTALMENTE la falta de mayúsculas, comas, puntos o signos de interrogación. SOLO marca error ("has_error": true) si hay fallos reales de conjugación, declinación o vocabulario incorrecto.

REGLA DE FORMATO ABSOLUTA: Responde SOLO con un objeto JSON plano.
Estructura obligatoria:
{
  "spanish_text": "Tu comentario o explicación breve en español nativo",
  "german_text": "La frase principal en alemán nativo (muy corta y fácil)",
  "has_error": false,
  "correction_es": "Si cometió un error real de gramática/vocabulario, explícalo aquí brevemente en español (o vacío)",
  "correction_de": "La corrección exacta en alemán (o vacío)",
  "suggestions": [
    {"de": "Opción 1 en alemán básico", "es": "Traducción 1"},
    {"de": "Opción 2 en alemán básico", "es": "Traducción 2"}
  ]
}`;

  const messages = [
    { role: 'system', content: systemPrompt }
  ];

  history.slice(-4).forEach((msg) => {
    messages.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.rawText || msg.text || `${msg.spanish_text} ${msg.german_text}`
    });
  });

  if (!isInitial) {
    messages.push({ role: 'user', content: `El alumno dijo: "${userText}"` });
  } else {
    messages.push({ role: 'user', content: `Inicia la clase saludando brevemente y haciendo una pregunta fácil sobre el tema.` });
  }

  return callGroqWithFallback(messages);
}

export async function translatePanicQuery(query) {
  if (!GROQ_API_KEY) throw new Error('Falta API Key de Groq');
  
  const messages = [
    { role: 'system', content: 'Traduce al alemán de forma sencilla (Nivel A1). Devuelve SOLO JSON: {"german": "...", "spanish": "...", "phonetic": "...", "tip": "..."}' },
    { role: 'user', content: query }
  ];
  
  return callGroqWithFallback(messages);
}
