import { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import Camera from './Camera';

export default function Game({ user, roomCode, onLeave }) {
  const [gameData, setGameData]       = useState(null);
  const [dartsThisTurn, setDarts]     = useState([]);
  const [turnScore, setTurnScore]     = useState(0);
  const [bust, setBust]               = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'rooms', roomCode), snap => {
      if (snap.exists()) setGameData(snap.data());
      else onLeave();
    });
    return () => unsub();
  }, [roomCode]);

  if (!gameData) return (
    <div style={{ minHeight: '100vh', background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>
      Chargement…
    </div>
  );

  const me       = gameData.players.find(p => p.uid === user.uid);
  const isMyTurn = gameData.currentTurn === user.uid;
  const gameOver = gameData.status === 'finished';
  const startScore = gameData.startScore || 301;

  const handleDartScored = (result) => {
    if (!isMyTurn || dartsThisTurn.length >= 3 || bust) return;
    const newDarts     = [...dartsThisTurn, result];
    const newTurnScore = turnScore + result.score;
    const newPlayerScore = me.score - newTurnScore;

    if (newPlayerScore < 0 || newPlayerScore === 1) {
      setBust(true);
      setDarts(newDarts);
      setTurnScore(newTurnScore);
      return;
    }

    setDarts(newDarts);
    setTurnScore(newTurnScore);

    if (newDarts.length === 3 || newPlayerScore === 0) {
      setTimeout(() => endTurn(newDarts, newTurnScore, newPlayerScore), 800);
    }
  };

  const endTurn = async (darts = dartsThisTurn, ts = turnScore, newScore = null) => {
    const roomRef    = doc(db, 'rooms', roomCode);
    const finalScore = bust ? me.score : (newScore !== null ? newScore : me.score - ts);
    const scored     = bust ? 0 : ts;

    const updatedPlayers = gameData.players.map(p =>
      p.uid === user.uid ? { ...p, score: finalScore } : p
    );
    const idx      = gameData.players.findIndex(p => p.uid === user.uid);
    const nextTurn = gameData.players[(idx + 1) % gameData.players.length].uid;
    const isWin    = finalScore === 0;

    await updateDoc(roomRef, {
      players: updatedPlayers,
      currentTurn: isWin ? user.uid : nextTurn,
      status: isWin ? 'finished' : 'playing',
      winner: isWin ? user.uid : null,
      lastTurn: {
        uid: user.uid, name: me.name,
        darts: darts.map(d => d.label),
        total: scored, bust,
      }
    });

    setDarts([]); setTurnScore(0); setBust(false);
  };

  const leaveGame = async () => {
    const roomRef   = doc(db, 'rooms', roomCode);
    const remaining = gameData.players.filter(p => p.uid !== user.uid);
    if (remaining.length === 0) await deleteDoc(roomRef);
    else await updateDoc(roomRef, {
      players: remaining,
      currentTurn: gameData.currentTurn === user.uid ? remaining[0].uid : gameData.currentTurn,
    });
    onLeave();
  };

  // ── ÉCRAN VICTOIRE ─────────────────────────────────────────────────────────
  if (gameOver) {
    const winner = gameData.players.find(p => p.uid === gameData.winner);
    const iWon   = gameData.winner === user.uid;
    return (
      <div style={{ minHeight: '100vh', background: '#080808', padding: 24, maxWidth: 480, margin: '0 auto', fontFamily: 'monospace' }}>
        <div style={{ textAlign: 'center', paddingTop: 60 }}>
          <div style={{ fontSize: 72 }}>{iWon ? '🏆' : '🎯'}</div>
          <h1 style={{ color: '#FF9100', fontWeight: 900, fontSize: 28, margin: '16px 0 8px', letterSpacing: 2 }}>
            {iWon ? 'GG, t\'as gagné !' : `${winner?.name} gagne !`}
          </h1>
          <div style={{ margin: '28px 0' }}>
            {[...gameData.players].sort((a, b) => a.score - b.score).map((p, i) => (
              <div key={p.uid} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: p.uid === gameData.winner ? 'rgba(255,145,0,0.1)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${p.uid === gameData.winner ? '#FF9100' : '#1a1a1a'}`,
                borderRadius: 10, padding: '12px 16px', marginBottom: 8
              }}>
                <span style={{ fontSize: 20 }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                <img src={p.photo} alt="" style={{ width: 36, borderRadius: '50%' }} />
                <span style={{ flex: 1, color: '#fff', fontWeight: 700 }}>{p.name}</span>
                <span style={{ color: '#555', fontSize: 13 }}>{p.score} restants</span>
              </div>
            ))}
          </div>
          <button onClick={onLeave} style={{
            background: 'transparent', border: '2px solid #FF9100', color: '#FF9100',
            borderRadius: 8, padding: '12px 32px', fontSize: 15, fontWeight: 700, cursor: 'pointer'
          }}>
            Retour au lobby
          </button>
        </div>
      </div>
    );
  }

  // ── JEU EN COURS ───────────────────────────────────────────────────────────
  const currentPlayer = gameData.players.find(p => p.uid === gameData.currentTurn);

  return (
    <div style={{ minHeight: '100vh', background: '#080808', padding: 16, maxWidth: 540, margin: '0 auto', fontFamily: 'monospace' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ color: '#FF9100', fontWeight: 900, fontSize: 20, letterSpacing: 4 }}>{roomCode}</span>
        <span style={{ color: '#333', fontSize: 12 }}>{startScore}</span>
        <button onClick={leaveGame} style={{ background: 'none', border: '1px solid #222', color: '#555', borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>
          Quitter
        </button>
      </div>

      {/* Scores */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
        {gameData.players.map(p => {
          const isActive = p.uid === gameData.currentTurn;
          const pct = (p.score / startScore) * 100;
          return (
            <div key={p.uid} style={{
              flex: '0 0 auto', minWidth: 100,
              background: isActive ? 'rgba(255,145,0,0.1)' : 'rgba(255,255,255,0.02)',
              border: `${isActive ? '1.5' : '1'}px solid ${isActive ? '#FF9100' : '#1a1a1a'}`,
              borderRadius: 10, padding: '10px 12px', position: 'relative', overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', bottom: 0, left: 0, height: 3, width: `${100 - pct}%`, background: isActive ? '#FF9100' : '#222', transition: 'width 0.5s' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <img src={p.photo} alt="" style={{ width: 22, borderRadius: '50%' }} />
                <span style={{ fontSize: 11, color: isActive ? '#FF9100' : '#666', fontWeight: 700, maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.uid === user.uid ? 'MOI' : p.name.split(' ')[0]}
                </span>
                {isActive && <span style={{ fontSize: 10 }}>🏹</span>}
              </div>
              <div style={{ fontSize: p.score <= 50 ? 26 : 22, fontWeight: 900, color: p.score <= 50 ? '#FF1744' : '#fff', lineHeight: 1 }}>
                {p.score}
              </div>
            </div>
          );
        })}
      </div>

      {/* Dernier tour */}
      {gameData.lastTurn && (
        <div style={{ background: '#0d0d0d', border: '1px solid #161616', borderRadius: 8, padding: '8px 12px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#444' }}>{gameData.lastTurn.name} :</span>
          {gameData.lastTurn.darts.map((d, i) => (
            <span key={i} style={{ background: '#1a1a1a', borderRadius: 4, padding: '2px 7px', fontSize: 12, color: '#fff' }}>{d}</span>
          ))}
          <span style={{ marginLeft: 'auto', color: gameData.lastTurn.bust ? '#FF1744' : '#FF9100', fontWeight: 700, fontSize: 13 }}>
            {gameData.lastTurn.bust ? 'BUST' : `+${gameData.lastTurn.total}`}
          </span>
        </div>
      )}

      {/* Indicateur de tour */}
      <div style={{ textAlign: 'center', padding: '10px 0', marginBottom: 12, borderTop: '1px solid #111', borderBottom: '1px solid #111' }}>
        {isMyTurn ? (
          <div>
            <span style={{ color: '#FF9100', fontWeight: 700, fontSize: 14 }}>🎯 TON TOUR</span>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 8 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 30, height: 30, borderRadius: '50%',
                  border: `2px solid ${i < dartsThisTurn.length ? '#FF9100' : '#333'}`,
                  background: i < dartsThisTurn.length ? 'rgba(255,145,0,0.2)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, color: '#FF9100', fontWeight: 700
                }}>
                  {i < dartsThisTurn.length ? dartsThisTurn[i].label : ''}
                </div>
              ))}
              <span style={{ color: '#888', fontSize: 13, alignSelf: 'center', marginLeft: 8 }}>
                = <b style={{ color: bust ? '#FF1744' : '#fff' }}>{bust ? 'BUST!' : turnScore}</b>
              </span>
            </div>
          </div>
        ) : (
          <span style={{ color: '#444', fontSize: 13 }}>
            Tour de <b style={{ color: '#888' }}>{currentPlayer?.name?.split(' ')[0]}</b>
          </span>
        )}
      </div>

      {/* Caméra */}
      <Camera
        onDartScored={handleDartScored}
        disabled={!isMyTurn || dartsThisTurn.length >= 3 || bust}
      />

      {/* Bouton fin de tour */}
      {isMyTurn && (dartsThisTurn.length > 0 || bust) && (
        <button onClick={() => endTurn()} style={{
          width: '100%', marginTop: 12, padding: 14, fontSize: 14, fontWeight: 700,
          background: 'transparent', cursor: 'pointer', borderRadius: 8,
          border: `2px solid ${bust ? '#FF1744' : '#FF9100'}`,
          color: bust ? '#FF1744' : '#FF9100',
        }}>
          {bust
            ? `💥 BUST — Fin de tour (score inchangé : ${me.score})`
            : `✅ Fin de tour — +${turnScore} (reste ${me.score - turnScore})`
          }
        </button>
      )}
    </div>
  );
}