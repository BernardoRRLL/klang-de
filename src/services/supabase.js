const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

const getAuthToken = () => {
  const saved = localStorage.getItem('klang_auth_session');
  if (!saved) return SUPABASE_ANON_KEY;
  try {
    const parsed = JSON.parse(saved);
    return parsed.access_token || SUPABASE_ANON_KEY;
  } catch {
    return SUPABASE_ANON_KEY;
  }
};

const getHeaders = (extra = {}) => ({
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${getAuthToken()}`,
  'Content-Type': 'application/json',
  ...extra
});

export const supabaseService = {
  isConfigured: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),

  // 1. AUTENTICACIÓN (SUPABASE AUTH)
  getCurrentSession() {
    try {
      const raw = localStorage.getItem('klang_auth_session');
      if (!raw) return null;
      const session = JSON.parse(raw);
      return session?.access_token ? session : null;
    } catch {
      return null;
    }
  },

  async signIn(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: email.trim(), password })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error_description || data.msg || 'Correo o contraseña incorrectos');
    }
    localStorage.setItem('klang_auth_session', JSON.stringify(data));
    return data;
  },

  signOut() {
    localStorage.removeItem('klang_auth_session');
  },

  // 2. PERFILES ESTILO NETFLIX (klang_profiles)
  async getProfiles() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/klang_profiles?select=*&order=updated_at.asc`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Error al cargar perfiles');
    return res.json();
  },

  async createProfile(profileData) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/klang_profiles`, {
      method: 'POST',
      headers: getHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify(profileData)
    });
    if (!res.ok) throw new Error('No se pudo crear el perfil');
    const data = await res.json();
    return data[0];
  },

  async updateProfile(id, updates) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/klang_profiles?id=eq.${id}`, {
      method: 'PATCH',
      headers: getHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify({ ...updates, updated_at: new Date().toISOString() })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data[0];
  },

  // 3. PROGRESO DE LECCIONES (klang_lesson_progress)
  async getProgress(profileId) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/klang_lesson_progress?profile_id=eq.${profileId}&select=lesson_id`,
      { headers: getHeaders() }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((r) => r.lesson_id);
  },

  async markLessonCompleted(profileId, lessonId) {
    await fetch(`${SUPABASE_URL}/rest/v1/klang_lesson_progress?on_conflict=profile_id,lesson_id`, {
      method: 'POST',
      headers: getHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify({ profile_id: profileId, lesson_id: lessonId, completed: true })
    });
  },

  // 4. CUADERNO DE VOCABULARIO (klang_vocabulary)
  async getVocabulary(profileId) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/klang_vocabulary?profile_id=eq.${profileId}&order=created_at.desc`,
      { headers: getHeaders() }
    );
    if (!res.ok) return [];
    return res.json();
  },

  async upsertVocabulary(profileId, items) {
    if (!items?.length) return;
    const payload = items.map((item) => ({
      profile_id: profileId,
      german: item.german,
      spanish: item.spanish,
      phonetic: item.phonetic || '',
      lesson_id: item.lessonId || 'custom'
    }));
    await fetch(`${SUPABASE_URL}/rest/v1/klang_vocabulary?on_conflict=profile_id,german`, {
      method: 'POST',
      headers: getHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify(payload)
    });
  },

  async deleteVocabularyItem(profileId, german) {
    await fetch(
      `${SUPABASE_URL}/rest/v1/klang_vocabulary?profile_id=eq.${profileId}&german=eq.${encodeURIComponent(german)}`,
      { method: 'DELETE', headers: getHeaders() }
    );
  },

  // 5. HISTORIAL DE SESIONES (klang_sessions)
  async getSessions(profileId) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/klang_sessions?profile_id=eq.${profileId}&order=updated_at.desc&limit=10`,
      { headers: getHeaders() }
    );
    if (!res.ok) return [];
    return res.json();
  },

  async saveSession(sessionObj) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/klang_sessions?on_conflict=id`, {
      method: 'POST',
      headers: getHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' }),
      body: JSON.stringify({ ...sessionObj, updated_at: new Date().toISOString() })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.[0] || null;
  },

  // 6. EDGE FUNCTION DE VOZ NEURONAL (klang-tts)
  async fetchEdgeTTS(text, tutorId, rate) {
    const voice = tutorId === 'stefan' ? 'de-DE-ConradNeural' : 'de-DE-KatjaNeural';
    const res = await fetch(`${SUPABASE_URL}/functions/v1/klang-tts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text, voice, rate })
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }
};

// Utilidad para comprimir selfies del teléfono a un cuadrado ligero de 200x200px
export const compressAvatarImage = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 200;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });