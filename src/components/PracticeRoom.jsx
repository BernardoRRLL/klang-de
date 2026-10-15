// ... (imports y lógica superior sin cambios) ...

  // Nueva función para manejar el audio secuencial de la respuesta del tutor
  const playBilingualAudio = async (msg) => {
    // IMPORTANTE: onSpeakText ahora DEBE ser asíncrono y aceptar un 3er parámetro 'es' o 'de'
    if (msg.spanish_text) {
      await onSpeakText(msg.spanish_text, 1.0, 'es');
    }
    if (msg.german_text) {
      await onSpeakText(msg.german_text, speechRate, 'de');
    }
  };

// ... (renderizado del header y orbe sin cambios) ...

      {/* 3. CONVERSACIÓN BILINGÜE DESPEJADA */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 max-w-2xl mx-auto w-full">
        {messages.map((msg) => {
          if (msg.role === 'user') {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[80%] rounded-3xl rounded-br-md bg-indigo-600 text-white px-4 py-2.5 shadow-sm flex items-center gap-2.5">
                  <p className="text-sm">{msg.text}</p>
                  <button
                    onClick={() => onSpeakText(msg.text, 0.9, 'de')} // Asumimos que el usuario intentó hablar alemán
                    className="p-1 rounded-full bg-indigo-700/70 text-indigo-200 hover:text-white shrink-0"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className="space-y-2">
              {/* Tarjeta de corrección limpia */}
              {msg.has_error && msg.correction_de && (
                <div className="rounded-2xl bg-amber-950/30 border border-amber-800/50 px-3.5 py-2.5 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-300">
                      💡 Mejor así: "{msg.correction_de}"
                    </span>
                    <button
                      onClick={() => onSpeakText(msg.correction_de, 0.75, 'de')}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-slate-900 text-amber-300"
                    >
                      🐢 Escuchar
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-300">{msg.correction_es}</p>
                </div>
              )}

              {/* Mensaje del Profesor */}
              <div className="rounded-3xl rounded-tl-md bg-slate-900/90 border border-slate-800/80 p-4 space-y-3 shadow-sm">
                
                {/* Bloque en Español */}
                {msg.spanish_text && (
                  <p className="text-sm text-slate-300 leading-relaxed">{msg.spanish_text}</p>
                )}

                {/* Bloque principal en Alemán */}
                {msg.german_text && (
                  <div className="rounded-2xl bg-slate-950/90 border border-slate-800/80 p-3 flex items-center justify-between gap-3 mt-2">
                    <div>
                      <p className="font-bold text-sm sm:text-base text-amber-300">
                        {msg.german_text}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => onSpeakText(msg.german_text, 0.75, 'de')}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-900 text-xs text-slate-300 hover:text-white"
                        title="Escuchar lento"
                      >
                        🐢
                      </button>
                      <button
                        onClick={() => playBilingualAudio(msg)}
                        className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30"
                        title="Escuchar Todo"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

// ... (renderizado del resto del componente, drawer de sugerencias) ...

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {suggestedReplies?.map((reply, i) => (
              <div key={i} className="rounded-2xl bg-slate-950 border border-slate-800 p-2.5 flex flex-col justify-between gap-1.5">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-xs text-white">{reply.de}</p>
                    <button
                      onClick={() => onSpeakText(reply.de, 0.8, 'de')}
                      className="p-1 rounded-lg bg-slate-900 text-amber-300 shrink-0"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[11px] text-emerald-400 mt-0.5">{reply.es}</p>
                </div>
                <div className="flex items-center justify-end pt-1 border-t border-slate-900">
                  <button
                    onClick={() => {
                      setShowHintsDrawer(false);
                      onSendUserTurn(reply.de);
                    }}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-indigo-950 text-indigo-300"
                  >
                    Usar
                  </button>
                </div>
              </div>
            ))}
          </div>

// ... (resto del modal panic query se mantiene igual pasándole 'de' al onSpeakText de ser necesario) ...
