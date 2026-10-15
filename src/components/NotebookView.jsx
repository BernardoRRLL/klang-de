import React from 'react';
import { ChevronLeft, Volume2, Trash2 } from 'lucide-react';

export default function NotebookView({ profile, onBack, onSpeak, onDeleteWord }) {
  const words = profile?.notebook || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      <header className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur border-b border-slate-900 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Volver</span>
          </button>
          <h2 className="font-bold text-sm">Cuaderno de {profile.name}</h2>
          <span className="text-xs text-emerald-400 font-semibold">{words.length} frases</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-5 space-y-3">
        {words.length === 0 ? (
          <div className="text-center py-12 text-xs text-slate-500">
            Las palabras nuevas que practiques en tus clases aparecerán automáticamente aquí.
          </div>
        ) : (
          words.map((item, idx) => (
            <div
              key={`${item.german}-${idx}`}
              className="rounded-3xl bg-slate-900/80 border border-slate-800 p-4 flex items-center justify-between gap-3"
            >
              <div className="space-y-0.5">
                <p className="font-bold text-sm sm:text-base text-white">{item.german}</p>
                <p className="text-xs text-emerald-300">{item.spanish}</p>
                {item.phonetic && (
                  <p className="text-[11px] text-slate-400 italic">[{item.phonetic}]</p>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => onSpeak(item.german, 0.75)}
                  className="px-2.5 py-2 rounded-xl bg-slate-800 text-xs"
                >
                  🐢
                </button>
                <button
                  onClick={() => onSpeak(item.german, 1.0)}
                  className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-300"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDeleteWord(item.german)}
                  className="p-2.5 text-slate-500 hover:text-rose-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}