import { TUTORS } from '../data/curriculum';

const GROQ_API_KEY = (import.meta.env.VITE_GROQ_API_KEY || '').trim();

const GROQ_MODELS = [
  'openai/gpt-oss-120b',
  'mixtral-8x7b-32768',
  'gemma2-9b-it'
];

// Tiempo máximo de espera por modelo (en milisegundos). 
// 8000 = 8 segundos.
const TIMEOUT_MS = 8000; 

async function callGroqWithFallback(messages) {
  let lastError = null;

  for (const modelName of GROQ_MODELS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

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
        }),
        signal: controller.signal // <-- Aquí conectamos el temporizador
      });

      clearTimeout(timeoutId); // Si responde a tiempo, cancelamos el temporizador

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
      clearTimeout(timeoutId);
      
      // Si el error fue por el temporizador (AbortError)
      if (err.name === 'AbortError') {
        lastError = new Error(`El modelo ${modelName} tardó demasiado (Timeout).`);
        console.warn(`[Groq] Timeout en ${modelName}. Pasando al siguiente modelo...`);
        continue; // Salta al siguiente modelo de la cascada
      }

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

  // PROMPT ACTUALIZADO: Añadimos "translation_es" a la regla de formato.
  const systemPrompt = `Eres ${tutorName}, un profesor de alemán empático que enseña a ${studentName}.
Tema: "${lesson.title}". Escenario: ${lesson.scenario}. Modo: ${correctionMode === 'strict' ? 'Estricto' : 'Fluido'}.

REGLAS PEDAGÓGICAS ABSOLUTAS:
1. EXPLICAR EN ESPAÑOL, EXIGIR EN ALEMÁN: Habla fluidamente en español para explicar el contexto o dar instrucciones. La frase que pidas al alumno debe ser en alemán Nivel A1 (muy corta y sencilla).
2. SEPARACIÓN ESTRICTA DE IDIOMAS: JAMÁS incluyas palabras, ejemplos o frases en alemán dentro del campo "spanish_text". El texto en "spanish_text" debe estar 100% en español puro para evitar que el navegador lo lea con acento incorrecto. Todo el alemán va EXCLUSIVAMENTE en "german_text" o "correction_de".
3. SISTEMA DE CORRECCIÓN (STOP & REPEAT): Si el alumno comete un error real de gramática o vocabulario en alemán, DETÉN EL ESCENARIO. Explica en español en qué se equivocó, dale la respuesta correcta y EXÍGELE que repita la frase correctamente.
4. VÁLVULA DE ESCAPE (AYUDA): Si el alumno te habla en español para pedir ayuda, preguntar cómo se dice algo o decir que no entiende, SUSPENDE LA EVALUACIÓN. No lo marques como error ("has_error": false). Respóndele en español resolviendo su duda y dale la frase en alemán en "german_text" para que continúe.
5. IGNORAR PUNTUACIÓN: El alumno usa dictado por voz. Ignora la falta de mayúsculas, comas o signos de interrogación.
6. PROGRESIÓN CONDICIONADA: Si el alumno respondió bien en alemán, felicítalo brevemente en español y avanza haciendo una nueva pregunta lógica.

REGLA DE FORMATO ABSOLUTA: Responde SOLO con un objeto JSON plano.
Estructura obligatoria:
{
  "spanish_text": "Tu explicación o respuesta a dudas 100% en español (CERO alemán aquí)",
  "german_text": "La frase o pregunta clave en alemán (o vacío)",
  "translation_es": "La traducción exacta al español de lo que dice german_text (o vacío si no hay german_text)",
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

  // Aumentamos el historial de 10 a 15 mensajes
  history.slice(-15).forEach((msg) => {
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

export async function transcribeAudioWithGroq(audioBlob) {
  if (!GROQ_API_KEY) throw new Error('Falta API Key de Groq');

  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.webm');
  formData.append('model', 'whisper-large-v3-turbo');
  formData.append('language', 'de'); 
  formData.append('response_format', 'json');

  try {
    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: formData
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Error Whisper: ${res.status} - ${errText}`);
    }

    const data = await res.json();
    return data.text.trim();
  } catch (err) {
    throw new Error(`Fallo en transcripción: ${err.message}`);
  }
}
