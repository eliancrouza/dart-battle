import { useState } from 'react';
import { auth } from './firebase';
import { updateProfile } from 'firebase/auth';

const AVATARS = [
  '🎯', '🏹', '⚡', '🔥', '💀', '👾', '🤖', '👻',
  '🦊', '🐺', '🦁', '🐯', '🦅', '🐉', '🎮', '👑'
];

const COLORS = [
  { name: 'Orange',  value: '#FF9100' },
  { name: 'Bleu',    value: '#2979FF' },
  { name: 'Vert',    value: '#00E676' },
  { name: 'Rouge',   value: '#FF1744' },
  { name: 'Violet',  value: '#D500F9' },
  { name: 'Cyan',    value: '#00E5FF' },
  { name: 'Rose',    value: '#FF4081' },
  { name: 'Jaune',   value: '#FFD600' },
];

export { AVATARS, COLORS };

export default function Profile({ user, onSave, onClose }) {
  const savedPrefs = JSON.parse(localStorage.getItem('dartProfile') || '{}');

  const [pseudo, setPseudo]   = useState(user?.displayName || '');
  const [avatar, setAvatar]   = useState(savedPrefs.avatar || '🎯');
  const [color, setColor]     = useState(savedPrefs.color  || '#FF9100');
  const [saving, setSaving]   = useState(false);

  const handleSave = async () => {
    if (!pseudo.trim()) return;
    setSaving(true);

    // Mettre à jour le pseudo Firebase
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, {
        displayName: pseudo.trim(),
      });
    }

    // Sauvegarder avatar + couleur en local
    const prefs = { avatar, color };
    localStorage.setItem('dartProfile', JSON.stringify(prefs));

    onSave({ pseudo: pseudo.trim(), avatar, color });
    setSaving(false);
  };

  return (
    <div style={s.overlay}>
      <div style={s.modal} className="pop-in">
        <div style={s.header}>
          <h2 style={s.title}>Mon profil</h2>
          {onClose && (
            <button onClick={onClose} style={s.closeBtn}>✕</button>
          )}
        </div>

        {/* Aperçu */}
        <div style={{ ...s.preview, borderColor: color }}>
          <span style={{ fontSize: 40 }}>{avatar}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{pseudo || 'Ton pseudo'}</div>
            <div style={{ color, fontSize: 12, fontWeight: 600, marginTop: 2 }}>● {COLORS.find(c => c.value === color)?.name}</div>
          </div>
        </div>

        {/* Pseudo */}
        <div style={s.section}>
          <label style={s.label}>Pseudo</label>
          <input
            value={pseudo}
            onChange={e => setPseudo(e.target.value)}
            maxLength={16}
            placeholder="Ton pseudo…"
            style={{ ...s.input, borderColor: pseudo ? color : '#1e1e28' }}
            autoFocus
          />
        </div>

        {/* Avatar */}
        <div style={s.section}>
          <label style={s.label}>Avatar</label>
          <div style={s.grid}>
            {AVATARS.map(a => (
              <button key={a} onClick={() => setAvatar(a)} style={{
                ...s.avatarBtn,
                background: avatar === a ? `${color}22` : 'transparent',
                border: `2px solid ${avatar === a ? color : '#1e1e28'}`,
                transform: avatar === a ? 'scale(1.15)' : 'scale(1)',
              }}>
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Couleur */}
        <div style={s.section}>
          <label style={s.label}>Couleur</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {COLORS.map(c => (
              <button key={c.value} onClick={() => setColor(c.value)} title={c.name} style={{
                width: 32, height: 32, borderRadius: '50%',
                background: c.value, border: `3px solid ${color === c.value ? '#fff' : 'transparent'}`,
                cursor: 'pointer', transition: 'transform 0.15s',
                transform: color === c.value ? 'scale(1.2)' : 'scale(1)',
              }} />
            ))}
          </div>
        </div>

        <button onClick={handleSave} disabled={saving || !pseudo.trim()} style={{
          ...s.saveBtn, background: `${color}22`, borderColor: color, color,
          opacity: !pseudo.trim() ? 0.4 : 1,
        }}>
          {saving ? '…' : '✅ Sauvegarder'}
        </button>
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100, padding: 16,
  },
  modal: {
    background: '#0e0e12', border: '1px solid #1e1e28',
    borderRadius: 16, padding: 24, width: '100%', maxWidth: 420,
    maxHeight: '90vh', overflowY: 'auto',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20,
  },
  title: {
    fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 2, color: '#fff',
  },
  closeBtn: {
    background: 'none', border: 'none', color: '#555', fontSize: 18, cursor: 'pointer',
  },
  preview: {
    display: 'flex', alignItems: 'center', gap: 16,
    background: '#16161c', border: '2px solid',
    borderRadius: 12, padding: '14px 18px', marginBottom: 20,
    transition: 'border-color 0.3s',
  },
  section: { marginBottom: 20 },
  label: {
    display: 'block', fontSize: 11, fontWeight: 700,
    letterSpacing: 2, color: '#888', textTransform: 'uppercase', marginBottom: 10,
  },
  input: {
    width: '100%', background: '#16161c', border: '2px solid',
    borderRadius: 8, color: '#fff', padding: '12px 14px',
    fontSize: 15, fontFamily: 'Inter', transition: 'border-color 0.2s',
  },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6,
  },
  avatarBtn: {
    fontSize: 22, padding: 6, borderRadius: 8,
    cursor: 'pointer', transition: 'all 0.15s',
  },
  saveBtn: {
    width: '100%', padding: 14, fontSize: 15, fontWeight: 700,
    border: '2px solid', borderRadius: 10, cursor: 'pointer',
    transition: 'all 0.2s', fontFamily: 'Inter',
  },
};