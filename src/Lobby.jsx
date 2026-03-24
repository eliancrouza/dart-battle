import { useState, useEffect } from 'react';
import { auth, provider, db } from './firebase';
import { signInWithPopup, signInWithRedirect, signOut, signInAnonymously, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import Profile, { COLORS } from './Profile';

export default function Lobby({ user, onEnterRoom }) {
  const [joinInput, setJoinInput]     = useState('');
  const [mode, setMode]               = useState(null);
  const [pseudo, setPseudo]           = useState('');
  const [startScore, setStartScore]   = useState(301);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [profile, setProfile]         = useState(() => {
    return JSON.parse(localStorage.getItem('dartProfile') || '{"avatar":"🎯","color":"#FF9100"}');
  });

  const accent = profile.color || '#FF9100';

  // Forcer l'ouverture du profil si pas encore configuré
  useEffect(() => {
    if (user && !localStorage.getItem('dartProfile')) setShowProfile(true);
  }, [user]);

  const loginGoogle = async () => {
    try { await signInWithPopup(auth, provider); }
    catch { await signInWithRedirect(auth, provider); }
  };

  const loginAnon = async () => {
    if (!pseudo.trim()) { setError('Entre un pseudo !'); return; }
    setLoading(true);
    try {
      const cred = await signInAnonymously(auth);
      await updateProfile(cred.user, { displayName: pseudo.trim() });
      auth.currentUser.displayName = pseudo.trim();
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const handleProfileSave = (prefs) => {
    setProfile({ avatar: prefs.avatar, color: prefs.color });
    setShowProfile(false);
  };

  const createGame = async () => {
    if (!user) return;
    setLoading(true);
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    const me = {
      uid:    user.uid,
      name:   user.displayName || 'Joueur',
      avatar: profile.avatar || '🎯',
      color:  profile.color  || '#FF9100',
      score:  startScore,
    };
    await setDoc(doc(db, 'rooms', code), {
      host: user.uid, players: [me],
      currentTurn: user.uid, status: 'waiting',
      startScore, winner: null, lastTurn: null, history: [],
    });
    onEnterRoom(code);
    setLoading(false);
  };

  const joinGame = async () => {
    if (!user) return;
    const code = joinInput.trim().toUpperCase();
    if (!code) { setError('Entre un code !'); return; }
    setLoading(true);
    const roomRef = doc(db, 'rooms', code);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) { setError('Room introuvable !'); setLoading(false); return; }
    const me = {
      uid:    user.uid,
      name:   user.displayName || 'Joueur',
      avatar: profile.avatar || '🎯',
      color:  profile.color  || '#FF9100',
      score:  snap.data().startScore || 301,
    };
    await updateDoc(roomRef, { players: arrayUnion(me) });
    onEnterRoom(code);
    setLoading(false);
  };

  return (
    <div style={s.wrap}>
      {/* Profil modal */}
      {showProfile && (
        <Profile
          user={user}
          onSave={handleProfileSave}
          onClose={user ? () => setShowProfile(false) : null}
        />
      )}

      {/* Logo */}
      <div style={s.logo} className="fade-in">
        <div style={{ ...s.logoIcon, borderColor: accent, boxShadow: `0 0 32px ${accent}44` }}>
          🎯
        </div>
        <h1 style={{ ...s.title, color: accent }}>DART BATTLE</h1>
        <p style={s.sub}>Joue aux fléchettes avec tes potes, à distance</p>
      </div>

      {/* Non connecté */}
      {!user && (
        <div style={s.card} className="fade-in">
          {!mode && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => setMode('google')} style={s.btn('#4285F4')}>
                <span style={{ fontWeight: 900, fontSize: 16 }}>G</span>
                Se connecter avec Google
              </button>
              <div style={s.divider}><span>ou</span></div>
              <button onClick={() => setMode('anon')} style={s.btn(accent)}>
                🎭 Jouer avec un pseudo
              </button>
            </div>
          )}
          {mode === 'google' && (
            <div className="slide-in">
              <button onClick={() => setMode(null)} style={s.back}>← Retour</button>
              <button onClick={loginGoogle} style={{ ...s.btn('#4285F4'), width: '100%', marginTop: 12 }}>
                Connexion Google
              </button>
            </div>
          )}
          {mode === 'anon' && (
            <div className="slide-in">
              <button onClick={() => setMode(null)} style={s.back}>← Retour</button>
              <input
                placeholder="Ton pseudo…" value={pseudo}
                onChange={e => { setPseudo(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && loginAnon()}
                style={{ ...s.input, marginTop: 12, borderColor: pseudo ? accent : '#1e1e28' }}
                autoFocus
              />
              <button onClick={loginAnon} disabled={loading}
                style={{ ...s.btn(accent), width: '100%', marginTop: 8 }}>
                {loading ? '…' : 'Jouer →'}
              </button>
            </div>
          )}
          {error && <p style={s.error}>{error}</p>}
        </div>
      )}

      {/* Connecté */}
      {user && (
        <div className="fade-in">
          {/* Profil bar */}
          <div style={{ ...s.profileBar, borderColor: accent }}>
            <span style={{ fontSize: 28 }}>{profile.avatar}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{user.displayName || 'Joueur'}</div>
              <div style={{ fontSize: 11, color: accent, fontWeight: 600 }}>
                ● {COLORS.find(c => c.value === accent)?.name || 'Custom'}
              </div>
            </div>
            <button onClick={() => setShowProfile(true)} style={{ ...s.iconBtn, borderColor: '#1e1e28', color: '#888' }}>
              ✏️
            </button>
            <button onClick={() => signOut(auth)} style={{ ...s.iconBtn, borderColor: '#1e1e28', color: '#555' }}>
              Déco
            </button>
          </div>

          {/* Créer */}
          <div style={s.card}>
            <label style={s.cardLabel}>Nouvelle partie</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {[301, 501].map(v => (
                <button key={v} onClick={() => setStartScore(v)} style={{
                  flex: 1, padding: 12, borderRadius: 8, fontWeight: 800, fontSize: 18,
                  cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'Bebas Neue',
                  letterSpacing: 2,
                  background: startScore === v ? `${accent}22` : 'transparent',
                  border: `2px solid ${startScore === v ? accent : '#1e1e28'}`,
                  color: startScore === v ? accent : '#444',
                }}>
                  {v}
                </button>
              ))}
            </div>
            <button onClick={createGame} disabled={loading} style={{
              ...s.btn(accent), width: '100%', padding: 16, fontSize: 16,
              background: `${accent}18`,
            }}>
              {loading ? '…' : '🆕 Créer la partie'}
            </button>
          </div>

          {/* Rejoindre */}
          <div style={s.card}>
            <label style={s.cardLabel}>Rejoindre une partie</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                placeholder="CODE" value={joinInput}
                onChange={e => { setJoinInput(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && joinGame()}
                style={{
                  ...s.input, flex: 1, textTransform: 'uppercase',
                  textAlign: 'center', letterSpacing: 6, fontSize: 20, fontWeight: 800,
                  borderColor: joinInput ? accent : '#1e1e28',
                }}
                maxLength={4}
              />
              <button onClick={joinGame} disabled={loading} style={{
                ...s.btn('#2979FF'), padding: '0 22px', fontSize: 20,
              }}>
                {loading ? '…' : '→'}
              </button>
            </div>
            {error && <p style={s.error}>{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  wrap: {
    minHeight: '100vh', background: 'var(--bg)',
    padding: '28px 16px', maxWidth: 440, margin: '0 auto',
  },
  logo: { textAlign: 'center', marginBottom: 36 },
  logoIcon: {
    fontSize: 52, display: 'inline-block',
    border: '2px solid', borderRadius: 20,
    padding: '12px 18px', marginBottom: 14,
    transition: 'box-shadow 0.3s',
  },
  title: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 42, letterSpacing: 8, margin: 0,
  },
  sub: { color: 'var(--text3)', fontSize: 13, margin: '8px 0 0' },
  card: {
    background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: 14, padding: '20px 18px', marginBottom: 12,
  },
  cardLabel: {
    display: 'block', fontSize: 10, fontWeight: 700,
    letterSpacing: 3, color: 'var(--text3)',
    textTransform: 'uppercase', marginBottom: 14,
  },
  btn: (color) => ({
    background: 'transparent', border: `2px solid ${color}`,
    color, borderRadius: 10, fontWeight: 700, cursor: 'pointer',
    fontSize: 14, padding: '13px 0',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 8, transition: 'all 0.2s', fontFamily: 'Inter',
  }),
  input: {
    background: 'var(--bg3)', border: '2px solid',
    borderRadius: 8, color: '#fff', padding: '13px 14px',
    fontSize: 14, width: '100%', boxSizing: 'border-box',
    fontFamily: 'Inter', transition: 'border-color 0.2s',
  },
  divider: {
    textAlign: 'center', color: 'var(--text3)', fontSize: 12,
    position: 'relative', padding: '4px 0',
  },
  profileBar: {
    display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14,
    padding: '12px 16px', background: 'var(--bg2)',
    border: '2px solid', borderRadius: 14, transition: 'border-color 0.3s',
  },
  iconBtn: {
    background: 'none', border: '1px solid', borderRadius: 6,
    padding: '6px 10px', fontSize: 13, cursor: 'pointer',
  },
  back: {
    background: 'none', border: 'none', color: 'var(--text3)',
    cursor: 'pointer', fontSize: 13, padding: 0,
  },
  error: { color: 'var(--danger)', fontSize: 12, marginTop: 8, textAlign: 'center' },
};