import React, { useState } from 'react';
import { BookOpen, Sparkles, Play, CheckCircle2, History, MessageSquare } from 'lucide-react';
import { CURRICULUM, TUTORS } from '../data/curriculum';

export default function Dashboard({
  profile,
  tutorId,
  onChangeTutor,
  onChangeProfile,
  onOpenNotebook,
  onStartLesson
}) {
  const [customTopic, setCustomTopic] = useState('');
  const activeTutor = TUTORS[tutorId] || TUTORS.stefan;

  const handleStartCustom = (e) => {
    e.preventDefault();
    if (!customTopic.trim()) return;
    const topic = customTopic.trim();
    setCustomTopic('');
    onStartLesson({
      id: `custom-${Date.now()}`,
      title: topic,
      level: profile.current_level || 'A1.0',
      scenario: `El alumno pidió practicar este tema específico hoy: "${topic}". Enséñale el vocabulario base y guíalo en una conversación progresiva.`,
      objectives: [
        'Dominar las palabras clave del tema',
        'Construir frases completas con buena pronunciación',
        'Completar al menos 6 intercambios con el profesor'
      ]
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20">
      {/* Barra superior limpia */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-slate-950/85 border-b border-slate-900 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={onChangeProfile}
            className="flex items-center gap-3 text-left group"
          >
            <div className="w-10 h-10 rounded-2xl overflow-hidden shadow">
              {profile.avatar_image ? (
                <img src={profile.avatar_image} alt={profile.name} className="w-full h-full object-cover" />
              ) : (
                <div
                  className={`w-full h-full bg-gradient-to-br ${
                    profile.avatar_color || 'from-blue-600 to-indigo-700'
                  } flex items-center justify-center font-bold text-base text-white`}
                >
                  {profile.avatar_icon && profile.avatar_icon !== 'user'
                    ? profile.avatar_icon
                    : profile.name[0]}
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-white">{profile.name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 group-hover:text-white">
                  Cambiar perfil
                </span>
              </div>
              <p className="text-[11px] text-slate-400">{profile.current_level}</p>
            </div>
          </button>

          <button
            onClick={onOpenNotebook}
            className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-900 border border-slate-800 text-xs font-semibold text-emerald-300 hover:border-emerald-700/60 transition"
          >
            <BookOpen className="w-4 h-4" />
            <span>Cuaderno ({(profile.notebook || []).length})</span>
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-6 space-y-7">
        {/* Selector de Tutor (Stefan / Clara) */}
        <section className="rounded-3xl bg-slate-900/70 border border-slate-800/80 p-4 flex items-center justify-between gap-3">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              Profesor asignado
            </span>
            <h2 className="text-sm font-bold text-white mt-0.5">
              {activeTutor.name} · <span className="text-slate-400 font-normal">{activeTutor.role}</span>
            </h2>
          </div>

          <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800">
            {Object.values(TUTORS).map((t) => (
              <button
                key={t.id}
                onClick={() => onChangeTutor(t.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                  tutorId === t.id
                    ? 'bg-slate-800 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </section>

        {/* Creador de Clase a Medida */}
        <section className="rounded-3xl bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-800/40 p-5 space-y-3 shadow-lg">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h3 className="font-bold text-sm text-white">
              ¿Qué quieres practicar hoy con {activeTutor.name}?
            </h3>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              'Practicar los números del 1 al 50',
              'Comprar pasajes de tren en la estación',
              'Pedir un café y cuenta en un restaurante',
              'Hablar sobre mi trabajo y equipo'
            ].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setCustomTopic(chip)}
                className="text-[11px] px-3 py-1 rounded-full bg-slate-950/70 border border-slate-800 text-slate-300 hover:border-indigo-500 hover:text-white transition"
              >
                {chip}
              </button>
            ))}
          </div>

          <form onSubmit={handleStartCustom} className="flex gap-2 pt-1">
            <input
              type="text"
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              placeholder="Escribe cualquier tema o situación..."
              className="flex-1 rounded-2xl bg-slate-950 border border-slate-800 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shrink-0 shadow transition"
            >
              Conversar
            </button>
          </form>
        </section>

        {/* Conversaciones Anteriores para Retomar */}
        {(profile.savedSessions || []).length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-sky-400" />
              <h3 className="font-bold text-sm text-white">Retomar conversaciones en curso</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {profile.savedSessions.slice(0, 4).map((sess) => (
                <button
                  key={sess.id}
                  onClick={() =>
                    onStartLesson(
                      {
                        id: sess.lesson_id,
                        title: sess.title,
                        level: profile.current_level,
                        scenario: sess.scenario_prompt || sess.title,
                        objectives: [
                          'Continuar la conversación pendiente',
                          'Aplicar las correcciones del profesor',
                          'Completar al menos 6 intercambios'
                        ]
                      },
                      sess
                    )
                  }
                  className="rounded-2xl bg-slate-900/75 border border-slate-800/90 hover:border-sky-500/50 p-3.5 text-left flex items-center justify-between gap-3 transition"
                >
                  <div className="min-w-0">
                    <h4 className="font-semibold text-xs text-white truncate">{sess.title}</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {(sess.messages || []).filter((m) => m.role === 'user').length} respuestas tuyas ·{' '}
                      {TUTORS[sess.tutor_id || 'stefan']?.name}
                    </p>
                  </div>
                  <MessageSquare className="w-4 h-4 text-sky-400 shrink-0" />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Las 7 Sesiones Base */}
        <div className="space-y-6">
          {CURRICULUM.map((module) => {
            const Icon = module.icon;
            return (
              <section key={module.id} className="space-y-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-amber-400" />
                    <h2 className="font-bold text-sm text-white">{module.title}</h2>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{module.description}</p>
                </div>

                <div className="space-y-2.5">
                  {module.lessons.map((lesson) => {
                    const isCompleted = (profile.completedLessons || []).includes(lesson.id);
                    return (
                      <div
                        key={lesson.id}
                        className="rounded-3xl bg-slate-900/80 border border-slate-800/90 p-4 flex items-center justify-between gap-4 hover:border-slate-700 transition"
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-amber-400">
                              Sesión {lesson.id} · {lesson.level}
                            </span>
                            {isCompleted && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Superada
                              </span>
                            )}
                          </div>
                          <h3 className="font-bold text-sm text-white">{lesson.title}</h3>
                          <p className="text-xs text-slate-400 line-clamp-2">{lesson.scenario}</p>
                        </div>

                        <button
                          onClick={() => onStartLesson(lesson)}
                          className="px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shrink-0 shadow transition"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Entrar</span>
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
    </div>
  );
}