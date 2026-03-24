import { useState, useEffect } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged, getRedirectResult } from 'firebase/auth';
import Lobby from './Lobby';
import Game from './Game';

export default function App() {
  const [user, setUser]         = useState(undefined);
  const [roomCode, setRoomCode] = useState(null);

  useEffect(() => {
    getRedirectResult(auth).catch(() => {});
    const unsub = onAuthStateChanged(auth, u => setUser(u || null));
    return () => unsub();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('roomCode');
    if (saved) setRoomCode(saved);
  }, []);

  const enterRoom = (code) => { localStorage.setItem('roomCode', code); setRoomCode(code); };
  const leaveRoom = ()     => { localStorage.removeItem('roomCode'); setRoomCode(null); };

  if (user === undefined) return (
    <div style={{ minHeight: '100vh', background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 40 }}>🎯</span>
    </div>
  );

  if (roomCode && user) return <Game user={user} roomCode={roomCode} onLeave={leaveRoom} />;
  return <Lobby user={user} onEnterRoom={enterRoom} />;
}