import { TUTORS } from '../data/curriculum';

// 1. Cambiamos la API Key a la de Groq
const GROQ_API_KEY = (import.meta.env.VITE_GROQ_API_KEY || '').trim();

// 2. Nueva función base que reemplaza la cascada de Gemini
async function callGroqModel(messages) {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
       model: 'qwen-3.8-27b', // Modelo ultra rápido
        messages: messages,
        temperature: 0.3,
        response_format: { type: "json_object" } // Fuerza el JSON estricto
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Error de Groq: ${res.status} - ${errText}`);
    }

    const data = await res.json();
    const rawText = data.choices[0].message.content;
    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    return JSON.parse(cleaned);

  } catch (err) {
    throw new Error(`Fallo en el motor de IA: ${err.message}`);
  }
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

  // 3. Mantenemos el prompt plano estructurado que App.jsx ya está esperando
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

  // 4. Adaptamos el historial al formato role/content de Groq/OpenAI
  const messages = [
    { role: 'system', content: systemPrompt }
  ];

  history.slice(-4).forEach((msg) => {
    messages.push({
      role: msg.role === 'user' ? 'user' : 'assistant', // Groq usa 'assistant' en lugar de 'model'
      content: msg.rawText || msg.text || `${msg.spanish_text} ${msg.german_text}`
    });
  });

  if (!isInitial) {
    messages.push({ role: 'user', content: `El alumno dijo: "${userText}"` });
  } else {
    messages.push({ role: 'user', content: `Inicia la clase saludando y proponiendo el primer ejercicio.` });
  }

  return callGroqModel(messages);
}

export async function translatePanicQuery(query) {
  if (!GROQ_API_KEY) throw new Error('Falta API Key de Groq');
  
  const messages = [
    { role: 'system', content: 'Traduce al alemán. Devuelve SOLO JSON: {"german": "...", "spanish": "...", "phonetic": "...", "tip": "..."}' },
    { role: 'user', content: query }
  ];
  
  return callGroqModel(messages);
}
