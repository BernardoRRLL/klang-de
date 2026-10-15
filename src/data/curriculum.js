import { Compass, Users, Briefcase } from 'lucide-react';

export const TUTORS = {
  stefan: {
    id: 'stefan',
    name: 'Stefan',
    gender: 'male',
    role: 'Coach de Alemán',
    accentColor: 'from-blue-500 to-indigo-600',
    glowColor: 'shadow-blue-500/30'
  },
  clara: {
    id: 'clara',
    name: 'Clara',
    gender: 'female',
    role: 'Coach de Alemán',
    accentColor: 'from-emerald-400 to-teal-600',
    glowColor: 'shadow-emerald-500/30'
  }
};

export const AVATAR_COLORS = [
  'from-blue-600 to-indigo-700',
  'from-emerald-500 to-teal-700',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-700',
  'from-violet-600 to-purple-800'
];

export const AVATAR_ICONS = ['👤', '⛵', '🏔️', '🚴', '🎯', '🎧', '🦊', '⚡'];

export const CURRICULUM = [
  {
    id: 'm1',
    title: 'Ruta 1: Base y Supervivencia (Desde Cero)',
    icon: Compass,
    description: 'Andamiaje guiado 70% español / 30% alemán para soltar la lengua.',
    lessons: [
      {
        id: '1.1',
        title: 'Primeros Contactos y Sonidos Clave',
        level: 'A1.0',
        scenario: 'Tu primera sesión con el tutor. Aprenderás a saludar según la hora, presentarte con "Ich heiße..." y dominar el sonido de la W y la ß.',
        objectives: [
          'Saludar formalmente (Guten Morgen / Guten Tag)',
          'Decir tu nombre usando "Ich heiße..."',
          'Responder "Mucho gusto" (Freut mich)'
        ]
      },
      {
        id: '1.2',
        title: 'Números, Precios y la Panadería',
        level: 'A1.1',
        scenario: 'Practicarás los números del 1 al 10 y cómo pedir cosas amablemente en una cafetería en Berlín usando "Ich möchte..." y "Bitte".',
        objectives: [
          'Pedir un café o pan usando "Ich möchte..."',
          'Usar un número del 1 al 5 en tu pedido',
          'Preguntar cuánto cuesta ("Was kostet das?")'
        ]
      },
      {
        id: '1.3',
        title: 'Estructura Básica: Querer, Poder y Tener',
        level: 'A1.1',
        scenario: 'Conversación guiada para armar tus primeras frases propias combinando "Ich habe" (tengo), "Ich kann" (puedo) y "Ich brauche" (necesito).',
        objectives: [
          'Decir algo que tienes o necesitas hoy',
          'Responder una pregunta completa en alemán',
          'Pedir que hablen más despacio ("Langsamer, bitte")'
        ]
      }
    ]
  },
  {
    id: 'm2',
    title: 'Ruta 2: Contexto Familiar y Cotidiano',
    icon: Users,
    description: 'Situaciones reales del día a día: horarios, familia, colegio y compras.',
    lessons: [
      {
        id: '2.1',
        title: 'La Familia, los Niños y el Colegio',
        level: 'A1.1',
        scenario: 'Charla cotidiana para presentar a tu familia, hablar de actividades escolares y entender palabras clave del día a día.',
        objectives: [
          'Mencionar a tu familia ("Meine Familie / Meine Kinder")',
          'Hablar de un horario o actividad escolar',
          'Hacer una pregunta sobre la rutina diaria'
        ]
      },
      {
        id: '2.2',
        title: 'Horarios, Fin de Semana y Actividades',
        level: 'A1.2',
        scenario: 'Planificando el fin de semana: hablar del clima, paseos al aire libre, deportes y coordinar horas del día.',
        objectives: [
          'Decir qué te gusta hacer el fin de semana',
          'Mencionar un día y una hora ("Am Samstag um 9 Uhr")',
          'Expresar preferencia con "Ich mag..." o "Ich gehe gern..."'
        ]
      }
    ]
  },
  {
    id: 'm3',
    title: 'Ruta 3: Mundo Profesional y Trabajo',
    icon: Briefcase,
    description: 'Presentaciones profesionales, reuniones, equipos y coordinación laboral.',
    lessons: [
      {
        id: '3.1',
        title: 'Presentar tu Rol y Experiencia',
        level: 'A1.2',
        scenario: 'Conoces a un colega alemán. Practicarás cómo explicar en qué trabajas, tu especialidad y de dónde vienes.',
        objectives: [
          'Explicar tu área profesional en alemán',
          'Mencionar que vienes de Chile ("Ich komme aus Chile")',
          'Preguntar al colega a qué se dedica ("Was machen Sie beruflich?")'
        ]
      },
      {
        id: '3.2',
        title: 'Coordinar una Reunión e Indicadores',
        level: 'A2.1',
        scenario: 'Estás coordinando una reunión de equipo: agendar fecha, revisar números básicos y confirmar acuerdos.',
        objectives: [
          'Proponer una hora para la reunión ("Haben Sie Zeit um...?")',
          'Confirmar un acuerdo ("Einverstanden / Das passt gut")',
          'Cerrar y agradecer la conversación formalmente'
        ]
      }
    ]
  }
];