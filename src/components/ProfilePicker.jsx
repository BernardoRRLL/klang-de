import React, { useState, useRef } from 'react';
import { Plus, Camera, Pencil, LogOut, Check, X } from 'lucide-react';
import { AVATAR_COLORS, AVATAR_ICONS } from '../data/curriculum';
import { compressAvatarImage } from '../services/supabase';

export default function ProfilePicker({
  profiles,
  onSelectProfile,
  onCreateProfile,
  onUpdateProfile,
  onLogout
}) {
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [modalProfile, setModalProfile] = useState(null); // null | { isNew, id, name, avatar_color, avatar_icon, avatar_image }
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const openNewProfileModal = () => {
    setModalProfile({
      isNew: true,
      name: '',
      role_description: 'Ruta Base + Conversación Cotidiana',
      avatar_color: AVATAR_COLORS[1],
      avatar_icon: '👤',
      avatar_image: null
    });
  };

  const openEditProfileModal = (profile) => {
    setModalProfile({
      isNew: false,
      ...profile,
      avatar_icon: profile.avatar_icon || '👤'
    });
  };

  const handlePhotoCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await compressAvatarImage(file);
      setModalProfile((prev) => ({ ...prev, avatar_image: base64 }));
    } catch {
      alert('No se pudo procesar la foto');
    }
  };

  const handleSaveModal = async (e) => {
    e.preventDefault();
    if (!modalProfile.name.trim()) return;
    setSaving(true);
    try {
      if (modalProfile.isNew) {
        const cleanId = modalProfile.name
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/g, '') + '-' + Date.now().toString().slice(-3);

        await onCreateProfile({
          id: cleanId,
          name: modalProfile.name.trim(),
          role_description: modalProfile.role_description,
          avatar_color: modalProfile.avatar_color,
          avatar_icon: modalProfile.avatar_icon,
          avatar_image: modalProfile.avatar_image,
          current_level: 'A1.0 (Desde Cero)',
          preferred_tutor: 'stefan',
          speech_rate: 0.85,
          mic_mode: 'ptt',
          correction_mode: 'strict'
        });
      } else {
        await onUpdateProfile(modalProfile.id, {
          name: modalProfile.name.trim(),
          avatar_color: modalProfile.avatar_color,
          avatar_icon: modalProfile.avatar_icon,
          avatar_image: modalProfile.avatar_image
        });
      }
      setModalProfile(null);
      setIsEditingMode(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6 select-none">
      <header className="flex items-center justify-between max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 via-red-500 to-slate-900 flex items-center justify-center font-black text-xs text-white">
            DE
          </div>
          <span className="font-bold text-base tracking-tight">KlangDE</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditingMode(!isEditingMode)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition ${
              isEditingMode
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
            }`}
          >
            {isEditingMode ? 'Listo' : 'Administrar perfiles'}
          </button>
          <button
            onClick={onLogout}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="my-auto max-w-2xl mx-auto w-full text-center space-y-8 py-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {isEditingMode ? 'Selecciona un perfil para editar' : '¿Quién va a practicar hoy?'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1.5">
            Puedes personalizar tu foto con la cámara del teléfono o crear un perfil adicional cuando quieras.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              onClick={() => (isEditingMode ? openEditProfileModal(profile) : onSelectProfile(profile))}
              className="group flex flex-col items-center gap-3 focus:outline-none"
            >
              <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-3xl overflow-hidden shadow-xl transition-transform duration-200 group-hover:scale-105 ring-2 ring-transparent group-hover:ring-white/80">
                {profile.avatar_image ? (
                  <img
                    src={profile.avatar_image}
                    alt={profile.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className={`w-full h-full bg-gradient-to-br ${
                      profile.avatar_color || AVATAR_COLORS[0]
                    } flex items-center justify-center text-4xl`}
                  >
                    {profile.avatar_icon && profile.avatar_icon !== 'user'
                      ? profile.avatar_icon
                      : profile.name[0]?.toUpperCase()}
                  </div>
                )}

                {isEditingMode && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                      <Pencil className="w-5 h-5 text-white" />
                    </div>
                  </div>
                )}
              </div>

              <div className="text-center">
                <span className="block font-bold text-base text-slate-200 group-hover:text-white">
                  {profile.name}
                </span>
                <span className="block text-[11px] text-slate-500">{profile.current_level}</span>
              </div>
            </button>
          ))}

          {/* Botón Estilo Netflix para Agregar Nuevo Perfil */}
          <button
            onClick={openNewProfileModal}
            className="group flex flex-col items-center gap-3 focus:outline-none"
          >
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-slate-900/70 border-2 border-dashed border-slate-800 group-hover:border-slate-500 flex flex-col items-center justify-center gap-1.5 transition-all group-hover:scale-105">
              <Plus className="w-8 h-8 text-slate-400 group-hover:text-white" />
              <span className="text-[11px] font-medium text-slate-400 group-hover:text-white">
                Nuevo perfil
              </span>
            </div>
            <div className="text-center">
              <span className="block font-semibold text-sm text-slate-400 group-hover:text-slate-200">
                Agregar
              </span>
              <span className="block text-[11px] text-transparent">.</span>
            </div>
          </button>
        </div>
      </main>

      <footer className="text-center text-xs text-slate-600">
        Sincronizado de forma segura con Supabase Auth
      </footer>

      {/* Modal para Crear o Editar Perfil (Foto con Cámara o Ícono) */}
      {modalProfile && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveModal}
            className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">
                {modalProfile.isNew ? 'Crear Nuevo Perfil' : `Editar a ${modalProfile.name}`}
              </h3>
              <button
                type="button"
                onClick={() => setModalProfile(null)}
                className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Vista previa del Avatar + Botón de Cámara del Teléfono */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-24 h-24 rounded-3xl overflow-hidden shadow-lg">
                {modalProfile.avatar_image ? (
                  <img
                    src={modalProfile.avatar_image}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className={`w-full h-full bg-gradient-to-br ${modalProfile.avatar_color} flex items-center justify-center text-3xl`}
                  >
                    {modalProfile.avatar_icon}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={handlePhotoCapture}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-1.5 shadow"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Tomar foto / Galería</span>
                </button>
                {modalProfile.avatar_image && (
                  <button
                    type="button"
                    onClick={() => setModalProfile((p) => ({ ...p, avatar_image: null }))}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 text-xs text-slate-300"
                  >
                    Usar ícono
                  </button>
                )}
              </div>
            </div>

            {/* Nombre */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Nombre del perfil</label>
              <input
                type="text"
                required
                value={modalProfile.name}
                onChange={(e) => setModalProfile((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ej: Ceci"
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Selector de Ícono y Color (si no usa foto) */}
            {!modalProfile.avatar_image && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Elige un ícono</label>
                  <div className="flex flex-wrap gap-2">
                    {AVATAR_ICONS.map((icon) => (
                      <button
                        type="button"
                        key={icon}
                        onClick={() => setModalProfile((p) => ({ ...p, avatar_icon: icon }))}
                        className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center border ${
                          modalProfile.avatar_icon === icon
                            ? 'bg-slate-800 border-amber-400'
                            : 'bg-slate-950 border-slate-800'
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Color de fondo</label>
                  <div className="flex gap-2">
                    {AVATAR_COLORS.map((color) => (
                      <button
                        type="button"
                        key={color}
                        onClick={() => setModalProfile((p) => ({ ...p, avatar_color: color }))}
                        className={`w-8 h-8 rounded-full bg-gradient-to-br ${color} ${
                          modalProfile.avatar_color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900' : ''
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalProfile(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{saving ? 'Guardando...' : 'Guardar Perfil'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}