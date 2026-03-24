import { useState } from 'react';
import { auth, provider, db } from './firebase';
import { signInWithPopup, signInWithRedirect, signOut, signInAnonymously, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';

export default function Lobby({ user, onEnterRoom }) {
  const [joinInput, setJoinInput]   = useState('');
  const [pseudo, setPseudo]         = useState('');
  const [mode, setMode]             = useState(null);
  const [startScore, setStartScore] = useState(301);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  const loginGoogle = async () => {
    try { await signInWithPopup(auth, provider); }
    catch { await signInWithRedirect(auth, provider); }
  };

    const loginAnon = async () => {
    if (!pseudo.trim()) { setError('Entre un pseudo !'); return; }
    setLoading(true);
    try {
        const cred = await signInAnonymously(auth);
        await updateProfile(cred.user, {
        displayName: pseudo.trim(),
        photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(pseudo.trim())}`
        });
        // Force la mise à jour du state sans reload
        auth.currentUser.displayName = pseudo.trim();
    } catch (e) { setError(e.message); }
    setLoading(false);
    };

  const createGame = async () => {
    if (!user) return;
    setLoading(true);
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    const me = {
      uid: user.uid,
      name: user.displayName || 'Joueur',
      photo: user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`,
      score: startScore,
    };
    await setDoc(doc(db, 'rooms', code), {
      host: user.uid,
      players: [me],
      currentTurn: user.uid,
      status: 'waiting',
      startScore,
      winner: null,
      lastTurn: null,
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
      uid: user.uid,
      name: user.displayName || 'Joueur',
      photo: user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`,
      score: snap.data().startScore || 301,
    };
    await updateDoc(roomRef, { players: arrayUnion(me) });
    onEnterRoom(code);
    setLoading(false);
  };

  return (
    <div style={s.wrap}>
      <div style={s.logo}>
        <span style={s.logoEmoji}>🎯</span>
        <h1 style={s.title}>DART BATTLE</h1>
        <p style={s.sub}>Joue aux fléchettes avec tes potes, à distance</p>
      </div>

      {!user && (
        <div style={s.card}>
          {!mode && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button onClick={() => setMode('google')} style={s.btn('#4285F4')}>
                G — Se connecter avec Google
              </button>
              <div style={s.divider}>ou</div>
              <button onClick={() => setMode('anon')} style={s.btn('#FF9100')}>
                🎭 Jouer avec un pseudo
              </button>
            </div>
          )}
          {mode === 'google' && (
            <div>
              <button onClick={() => setMode(null)} style={s.back}>← Retour</button>
              <button onClick={loginGoogle} style={{ ...s.btn('#4285F4'), width: '100%', marginTop: 12 }}>
                Connexion Google
              </button>
            </div>
          )}
          {mode === 'anon' && (
            <div>
              <button onClick={() => setMode(null)} style={s.back}>← Retour</button>
              <input placeholder="Ton pseudo…" value={pseudo}
                onChange={e => { setPseudo(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && loginAnon()}
                style={{ ...s.input, marginTop: 12 }} autoFocus />
              <button onClick={loginAnon} disabled={loading}
                style={{ ...s.btn('#FF9100'), width: '100%', marginTop: 8 }}>
                {loading ? '…' : 'Jouer →'}
              </button>
            </div>
          )}
          {error && <p style={s.error}>{error}</p>}
        </div>
      )}

      {user && (
        <div>
          <div style={s.profile}>
            <img src={user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`}
              alt="" style={{ width: 36, borderRadius: '50%' }} />
            <span style={{ color: '#fff', fontWeight: 700 }}>{user.displayName || 'Joueur'}</span>
            <button onClick={() => signOut(auth)} style={s.decoBtn}>Déco</button>
          </div>

          <div style={s.card}>
            <h2 style={s.cardTitle}>Nouvelle partie</h2>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {[301, 501].map(v => (
                <button key={v} onClick={() => setStartScore(v)} style={{
                  flex: 1, padding: 10,
                  background: startScore === v ? 'rgba(255,145,0,0.15)' : 'transparent',
                  border: `1.5px solid ${startScore === v ? '#FF9100' : '#333'}`,
                  color: startScore === v ? '#FF9100' : '#888',
                  borderRadius: 6, fontWeight: 700, fontSize: 15, cursor: 'pointer'
                }}>{v}</button>
              ))}
            </div>
            <button onClick={createGame} disabled={loading}
              style={{ ...s.btn('#FF9100'), width: '100%', padding: 14, fontSize: 15 }}>
              {loading ? '…' : '🆕 Créer la partie'}
            </button>
          </div>

          <div style={s.card}>
            <h2 style={s.cardTitle}>Rejoindre</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <input placeholder="CODE" value={joinInput}
                onChange={e => { setJoinInput(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && joinGame()}
                style={{ ...s.input, flex: 1, textTransform: 'uppercase', textAlign: 'center', letterSpacing: 4, fontSize: 18, fontWeight: 700 }}
                maxLength={4} />
              <button onClick={joinGame} disabled={loading}
                style={{ ...s.btn('#2979FF'), padding: '0 20px' }}>
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
  wrap: { minHeight: '100vh', background: '#080808', padding: '24px 16px', maxWidth: 420, margin: '0 auto' },
  logo: { textAlign: 'center', marginBottom: 32 },
  logoEmoji: { fontSize: 56, display: 'block', marginBottom: 8 },
  title: { color: '#FF9100', fontWeight: 900, fontSize: 32, margin: 0, letterSpacing: 6, fontFamily: 'monospace' },
  sub: { color: '#444', fontSize: 13, margin: '8px 0 0' },
  card: { background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 12, padding: '20px 16px', marginBottom: 14 },
  cardTitle: { color: '#888', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 14px' },
  btn: (color) => ({ background: 'transparent', border: `1.5px solid ${color}`, color, borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 14, padding: '12px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }),
  input: { background: '#111', border: '1px solid #222', borderRadius: 6, color: '#fff', padding: '12px 14px', fontSize: 14, width: '100%', boxSizing: 'border-box', fontFamily: 'monospace' },
  divider: { textAlign: 'center', color: '#333', fontSize: 12 },
  profile: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '10px 14px', background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 10 },
  decoBtn: { marginLeft: 'auto', background: 'none', border: '1px solid #333', color: '#666', borderRadius: 4, padding: '4px 10px', fontSize: 12, cursor: 'pointer' },
  back: { background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 13, padding: 0 },
  error: { color: '#FF1744', fontSize: 12, marginTop: 8, textAlign: 'center' },
};