import { TUTORS } from '../data/curriculum';

const GROQ_API_KEY = (import.meta.env.VITE_GROQ_API_KEY || '').trim();

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
          temperature: 0.6,
          response_format: { type: "json_object" }
        })
      });

      if (res.status === 404 || res.status === 400) {
        const errText = await res.text();
        lastError = new Error(`${modelName} falló: ${res.status} - ${errText}`);
        continue; 
      }

      if (!res.ok) {
        const errText = await res.text();
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

  // PROMPT ACTUALIZADO: Estilo Praktika (Explicar en español, frenar en el error, practicar A1)
  const systemPrompt = `Eres ${tutorName}, un profesor de alemán empático que enseña a ${studentName}.
Tema: "${lesson.title}". Escenario: ${lesson.scenario}. Modo: ${correctionMode === 'strict' ? 'Estricto' : 'Fluido'}.

REGLAS PEDAGÓGICAS ABSOLUTAS:
1. EXPLICAR EN ESPAÑOL, EXIGIR EN ALEMÁN: Eres libre de hablar fluidamente en español para explicar el contexto del escenario, animar al alumno o dar instrucciones. Sin embargo, la frase que le pidas al alumno que diga (o la frase clave del escenario) debe ser en alemán Nivel A1 (muy corta y sencilla).
2. SISTEMA DE CORRECCIÓN (STOP & REPEAT): Si el alumno comete un error real de gramática, conjugación o vocabulario, DETÉN EL ESCENARIO. Usa tu texto en español para explicarle amablemente en qué se equivocó, dale la respuesta correcta y EXÍGELE que repita la frase correctamente antes de poder avanzar a la siguiente pregunta.
3. IGNORAR PUNTUACIÓN: El alumno usa dictado por voz. Ignora absolutamente la falta de mayúsculas, comas o signos de interrogación. Solo evalúa el idioma.
4. PROGRESIÓN CONDICIONADA: Si el alumno respondió bien, felicítalo brevemente en español y avanza el escenario haciendo una nueva pregunta lógica.

REGLA DE FORMATO ABSOLUTA: Responde SOLO con un objeto JSON plano.
Estructura obligatoria:
{
  "spanish_text": "Tu explicación, instrucción o corrección detallada en español",
  "german_text": "La frase o pregunta clave en alemán",
  "has_error": false,
  "correction_es": "Breve nota de corrección en español (o vacío)",
  "correction_de": "La palabra o frase corregida en alemán (o vacío)",
  "suggestions": [
    {"de": "Una opción válida que el alumno podría responder", "es": "Su traducción"}
  ]
}`;

  const messages = [
    { role: 'system', content: systemPrompt }
  ];

  history.slice(-10).forEach((msg) => {
    messages.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.rawText || msg.text || `${msg.spanish_text} ${msg.german_text}`
    });
  });

  if (!isInitial) {
    messages.push({ role: 'user', content: `El alumno dijo: "${userText}"` });
  } else {
    messages.push({ role: 'user', content: `Inicia la clase presentándote en español, introduce el escenario y hazle la primera pregunta sencilla en alemán.` });
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
