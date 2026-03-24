import { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import Camera from './Camera';
import Profile from './Profile';


function DartPad({ accent, onScore }) {
  const [multiplier, setMultiplier] = useState(1);
  const [selected, setSelected]     = useState(null);

const SECTORS = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20];

  const multLabel = { 1: 'Simple', 2: 'Double', 3: 'Triple' };
  const multColor = { 1: '#888', 2: '#2979FF', 3: '#FF9100' };

  const confirm = (sector) => {
    const s = sector ?? selected;
    if (s === null) return;
    let score, label;
    if (s === 'BULL')  { score = 25;       label = 'BULL';        }
    else if (s === 'DBULL') { score = 50;  label = 'DOUBLE BULL'; }
    else { score = s * multiplier; label = multiplier === 2 ? `D${s}` : multiplier === 3 ? `T${s}` : `${s}`; }
    onScore({ score, label, multiplier: s === 'BULL' || s === 'DBULL' ? 1 : multiplier });
  };

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginTop: 10 }} className="fade-in">

      {/* Multiplicateur */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[1, 2, 3].map(m => (
          <button key={m} onClick={() => setMultiplier(m)} style={{
            flex: 1, padding: '10px 0', borderRadius: 8, fontWeight: 700,
            fontSize: 13, cursor: 'pointer', fontFamily: 'Inter',
            background: multiplier === m ? `${multColor[m]}22` : 'transparent',
            border: `2px solid ${multiplier === m ? multColor[m] : 'var(--border)'}`,
            color: multiplier === m ? multColor[m] : 'var(--text3)',
            transition: 'all 0.15s',
          }}>
            {multLabel[m]}
          </button>
        ))}
      </div>

      {/* Aperçu score */}
      <div style={{ textAlign: 'center', marginBottom: 12, minHeight: 32 }}>
        {selected !== null && selected !== 'BULL' && selected !== 'DBULL' && (
          <span style={{ fontFamily: "'Bebas Neue'", fontSize: 28, letterSpacing: 3, color: accent }}>
            {multiplier === 2 ? `D${selected}` : multiplier === 3 ? `T${selected}` : selected}
            {' = '}
            <span style={{ color: '#fff' }}>{selected * multiplier} pts</span>
          </span>
        )}
      </div>

      {/* Grille secteurs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 10 }}>
        {SECTORS.map(n => (
          <button key={n} onClick={() => { setSelected(n); confirm(n); }} style={{
            padding: '11px 0', borderRadius: 7, fontWeight: 800,
            fontSize: 15, cursor: 'pointer',
            fontFamily: "'Bebas Neue'", letterSpacing: 1,
            background: selected === n ? `${accent}22` : 'var(--bg3)',
            border: `1px solid ${selected === n ? accent : 'var(--border)'}`,
            color: selected === n ? accent : '#fff',
            transition: 'all 0.1s',
          }}>
            {n}
          </button>
        ))}
      </div>

      {/* Bull */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button onClick={() => confirm('BULL')} style={{
          padding: '12px 0', borderRadius: 8, fontWeight: 700,
          fontSize: 14, cursor: 'pointer', fontFamily: 'Inter',
          background: 'rgba(0,230,118,0.1)', border: '1px solid #00E676', color: '#00E676',
        }}>
          🟢 Bull — 25
        </button>
        <button onClick={() => confirm('DBULL')} style={{
          padding: '12px 0', borderRadius: 8, fontWeight: 700,
          fontSize: 14, cursor: 'pointer', fontFamily: 'Inter',
          background: 'rgba(255,23,68,0.1)', border: '1px solid var(--danger)', color: 'var(--danger)',
        }}>
          🔴 Double Bull — 50
        </button>
      </div>
    </div>
  );
}

export default function Game({ user, roomCode, onLeave }) {
  const [gameData, setGameData]       = useState(null);
  const [dartsThisTurn, setDarts]     = useState([]);
  const [turnScore, setTurnScore]     = useState(0);
  const [bust, setBust]               = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [showManual, setShowManual]   = useState(false);
  const [profile, setProfile]         = useState(() =>
    JSON.parse(localStorage.getItem('dartProfile') || '{"avatar":"🎯","color":"#FF9100"}')
  );

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'rooms', roomCode), snap => {
      if (snap.exists()) setGameData(snap.data());
      else onLeave();
    });
    return () => unsub();
  }, [roomCode]);

  if (!gameData) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>
      Chargement…
    </div>
  );

  const me         = gameData.players.find(p => p.uid === user.uid);
  const isMyTurn   = gameData.currentTurn === user.uid;
  const gameOver   = gameData.status === 'finished';
  const startScore = gameData.startScore || 301;
  const accent     = me?.color || '#FF9100';

  // ── Fléchette détectée ────────────────────────────────────────────────────
  const handleDartScored = (result) => {
    if (!isMyTurn || dartsThisTurn.length >= 3 || bust) return;
    const newDarts      = [...dartsThisTurn, result];
    const newTurnScore  = turnScore + result.score;
    const newPlayerScore = me.score - newTurnScore;

    if (newPlayerScore < 0 || newPlayerScore === 1) {
      setBust(true); setDarts(newDarts); setTurnScore(newTurnScore); return;
    }
    setDarts(newDarts); setTurnScore(newTurnScore);
    if (newDarts.length === 3 || newPlayerScore === 0)
      setTimeout(() => endTurn(newDarts, newTurnScore, newPlayerScore), 800);
  };

  // ── Saisie manuelle ───────────────────────────────────────────────────────
  const handleManualInput = (val) => {
    if (val === 'DEL') { setManualInput(p => p.slice(0, -1)); return; }
    if (val === 'OK') {
      const pts = parseInt(manualInput);
      if (isNaN(pts) || pts < 0 || pts > 180) return;
      const result = { score: pts, label: `${pts}`, multiplier: 1 };
      handleDartScored(result);
      setManualInput('');
      setShowManual(false);
      return;
    }
    if (manualInput.length >= 3) return;
    setManualInput(p => p + val);
  };

  // ── Corriger dernier score ─────────────────────────────────────────────────
  const correctLastDart = () => {
    if (dartsThisTurn.length === 0) return;
    const last      = dartsThisTurn[dartsThisTurn.length - 1];
    const newDarts  = dartsThisTurn.slice(0, -1);
    const newScore  = turnScore - last.score;
    setDarts(newDarts); setTurnScore(newScore); setBust(false);
  };

  // ── Fin de tour ───────────────────────────────────────────────────────────
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

    const turnEntry = {
      uid: user.uid, name: me.name, avatar: me.avatar || '🎯',
      darts: darts.map(d => d.label), total: scored, bust,
    };

    await updateDoc(roomRef, {
      players: updatedPlayers,
      currentTurn: isWin ? user.uid : nextTurn,
      status: isWin ? 'finished' : 'playing',
      winner: isWin ? user.uid : null,
      lastTurn: turnEntry,
      history: [...(gameData.history || []), turnEntry],
    });

    setDarts([]); setTurnScore(0); setBust(false);
  };

  // ── Quitter ────────────────────────────────────────────────────────────────
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

  // ── VICTOIRE ──────────────────────────────────────────────────────────────
  if (gameOver) {
    const winner = gameData.players.find(p => p.uid === gameData.winner);
    const iWon   = gameData.winner === user.uid;
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: 24, maxWidth: 480, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', paddingTop: 50 }} className="pop-in">
          <div style={{ fontSize: 72, marginBottom: 8 }}>{iWon ? '🏆' : winner?.avatar || '🎯'}</div>
          <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: 36, letterSpacing: 3, color: iWon ? accent : winner?.color || '#FF9100', margin: '0 0 6px' }}>
            {iWon ? 'GG, t\'as gagné !' : `${winner?.name} gagne !`}
          </h1>
          <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 28 }}>Partie terminée</p>

          {[...gameData.players].sort((a, b) => a.score - b.score).map((p, i) => (
            <div key={p.uid} className="slide-in" style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: p.uid === gameData.winner ? `${p.color}18` : 'var(--bg2)',
              border: `1px solid ${p.uid === gameData.winner ? p.color : 'var(--border)'}`,
              borderRadius: 12, padding: '14px 16px', marginBottom: 8,
              animationDelay: `${i * 0.1}s`,
            }}>
              <span style={{ fontSize: 20 }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
              <span style={{ fontSize: 28 }}>{p.avatar || '🎯'}</span>
              <span style={{ flex: 1, fontWeight: 700 }}>{p.name}</span>
              <span style={{ color: 'var(--text3)', fontSize: 13 }}>{p.score} restants</span>
            </div>
          ))}

          {/* Historique */}
          {gameData.history?.length > 0 && (
            <div style={{ marginTop: 20, textAlign: 'left' }}>
              <button onClick={() => setShowHistory(!showHistory)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13, cursor: 'pointer', marginBottom: 10 }}>
                {showHistory ? '▲' : '▼'} Historique des manches
              </button>
              {showHistory && (
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {gameData.history.map((h, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                      <span>{h.avatar}</span>
                      <span style={{ color: 'var(--text2)', minWidth: 80 }}>{h.name}</span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {h.darts.map((d, j) => (
                          <span key={j} style={{ background: 'var(--bg3)', borderRadius: 4, padding: '2px 6px', fontFamily: 'monospace', fontSize: 12 }}>{d}</span>
                        ))}
                      </div>
                      <span style={{ marginLeft: 'auto', color: h.bust ? 'var(--danger)' : accent, fontWeight: 700 }}>
                        {h.bust ? 'BUST' : `+${h.total}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <button onClick={onLeave} style={{ ...btnStyle(accent), width: '100%', padding: 14, fontSize: 15, marginTop: 24 }}>
            Retour au lobby
          </button>
        </div>
      </div>
    );
  }

  // ── JEU EN COURS ──────────────────────────────────────────────────────────
  const currentPlayer = gameData.players.find(p => p.uid === gameData.currentTurn);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: 16, maxWidth: 540, margin: '0 auto' }}>

      {showProfile && (
        <Profile user={user} onSave={p => { setProfile({ avatar: p.avatar, color: p.color }); setShowProfile(false); }} onClose={() => setShowProfile(false)} />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: "'Bebas Neue'", fontSize: 22, letterSpacing: 4, color: accent }}>{roomCode}</span>
          <span style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px', fontSize: 11, color: 'var(--text3)' }}>{startScore}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setShowHistory(!showHistory)} style={{ ...iconBtn, color: showHistory ? accent : '#555' }}>📋</button>
          <button onClick={() => setShowProfile(true)} style={{ ...iconBtn, color: '#555' }}>✏️</button>
          <button onClick={leaveGame} style={{ ...iconBtn, color: 'var(--danger)' }}>✕</button>
        </div>
      </div>

      {/* Historique inline */}
      {showHistory && gameData.history?.length > 0 && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 12, maxHeight: 160, overflowY: 'auto' }} className="fade-in">
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: 'var(--text3)', marginBottom: 8 }}>HISTORIQUE</div>
          {[...gameData.history].reverse().map((h, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
              <span>{h.avatar}</span>
              <span style={{ color: 'var(--text2)', minWidth: 70, fontSize: 11 }}>{h.name}</span>
              <div style={{ display: 'flex', gap: 3 }}>
                {h.darts.map((d, j) => (
                  <span key={j} style={{ background: 'var(--bg3)', borderRadius: 3, padding: '1px 5px', fontFamily: 'monospace', fontSize: 11 }}>{d}</span>
                ))}
              </div>
              <span style={{ marginLeft: 'auto', color: h.bust ? 'var(--danger)' : h.color || accent, fontWeight: 700, fontSize: 12 }}>
                {h.bust ? 'BUST' : `+${h.total}`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Scores joueurs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
        {gameData.players.map(p => {
          const isActive = p.uid === gameData.currentTurn;
          const pct = ((startScore - p.score) / startScore) * 100;
          return (
            <div key={p.uid} className={isActive ? 'glow' : ''} style={{
              flex: '0 0 auto', minWidth: 110,
              background: isActive ? `${p.color || accent}12` : 'var(--bg2)',
              border: `${isActive ? 2 : 1}px solid ${isActive ? (p.color || accent) : 'var(--border)'}`,
              borderRadius: 12, padding: '10px 12px',
              position: 'relative', overflow: 'hidden',
              transition: 'all 0.3s',
            }}>
              {/* Barre de progression */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, height: 3,
                width: `${pct}%`, background: p.color || accent,
                transition: 'width 0.6s ease', borderRadius: '0 2px 0 0',
              }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 20 }}>{p.avatar || '🎯'}</span>
                {isActive && <span style={{ fontSize: 10, color: p.color || accent }} className="pulse">●</span>}
              </div>
              <div style={{ fontSize: 11, color: p.uid === user.uid ? (p.color || accent) : 'var(--text3)', fontWeight: 600, marginBottom: 4, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.uid === user.uid ? 'MOI' : p.name}
              </div>
              <div style={{
                fontFamily: "'Bebas Neue'", letterSpacing: 1,
                fontSize: p.score <= 50 ? 32 : 28,
                color: p.score <= 50 ? 'var(--danger)' : '#fff',
                lineHeight: 1,
              }}>
                {p.score}
              </div>
            </div>
          );
        })}
      </div>

      {/* Dernier tour */}
      {gameData.lastTurn && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }} className="slide-in">
          <span style={{ fontSize: 16 }}>{gameData.lastTurn.avatar}</span>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{gameData.lastTurn.name} :</span>
          {gameData.lastTurn.darts.map((d, i) => (
            <span key={i} style={{ background: 'var(--bg3)', borderRadius: 4, padding: '2px 7px', fontSize: 12, fontFamily: 'monospace' }}>{d}</span>
          ))}
          <span style={{ marginLeft: 'auto', color: gameData.lastTurn.bust ? 'var(--danger)' : (gameData.lastTurn.color || accent), fontWeight: 700, fontSize: 13 }}>
            {gameData.lastTurn.bust ? 'BUST' : `+${gameData.lastTurn.total}`}
          </span>
        </div>
      )}

      {/* Indicateur de tour */}
      <div style={{ textAlign: 'center', padding: '10px 0', marginBottom: 12, borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        {isMyTurn ? (
          <div>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 18, letterSpacing: 3, color: accent, marginBottom: 8 }}>
              🎯 TON TOUR
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 36, height: 36, borderRadius: '50%',
                  border: `2px solid ${i < dartsThisTurn.length ? accent : 'var(--border)'}`,
                  background: i < dartsThisTurn.length ? `${accent}22` : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, color: accent, fontWeight: 700,
                  transition: 'all 0.2s',
                }}>
                  {i < dartsThisTurn.length ? dartsThisTurn[i].label : ''}
                </div>
              ))}
              <span style={{ color: 'var(--text3)', fontSize: 14, marginLeft: 8 }}>
                = <b style={{ color: bust ? 'var(--danger)' : '#fff', fontSize: 16 }}>{bust ? 'BUST!' : turnScore}</b>
              </span>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>{currentPlayer?.avatar}</span>
            <span style={{ color: 'var(--text3)', fontSize: 13 }}>
              Tour de <b style={{ color: currentPlayer?.color || '#fff' }}>{currentPlayer?.name}</b>
            </span>
          </div>
        )}
      </div>

      {/* Caméra */}
      <Camera onDartScored={handleDartScored} disabled={!isMyTurn || dartsThisTurn.length >= 3 || bust} />

      {/* Actions manuelles */}
      {isMyTurn && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button onClick={() => setShowManual(!showManual)} style={{ ...btnStyle('#888'), flex: 1, padding: 10, fontSize: 13 }}>
            ⌨️ Saisie manuelle
          </button>
          {dartsThisTurn.length > 0 && (
            <button onClick={correctLastDart} style={{ ...btnStyle('var(--danger)'), flex: 1, padding: 10, fontSize: 13 }}>
              ↩️ Corriger
            </button>
          )}
        </div>
      )}
        {/* Pavé fléchettes */}
        {showManual && isMyTurn && (
        <DartPad accent={accent} onScore={(result) => {
            handleDartScored(result);
            setShowManual(false);
        }} />
        )}
      {/* Bouton fin de tour */}
      {isMyTurn && (dartsThisTurn.length > 0 || bust) && (
        <button onClick={() => endTurn()} style={{
          ...btnStyle(bust ? 'var(--danger)' : accent),
          width: '100%', marginTop: 12, padding: 14, fontSize: 14,
          background: bust ? 'rgba(255,23,68,0.08)' : `${accent}10`,
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

const btnStyle = (color) => ({
  background: 'transparent', border: `2px solid ${color}`,
  color, borderRadius: 10, fontWeight: 700, cursor: 'pointer',
  fontSize: 14, display: 'flex', alignItems: 'center',
  justifyContent: 'center', gap: 6, fontFamily: 'Inter',
  transition: 'all 0.2s',
});

const iconBtn = {
  background: 'none', border: '1px solid var(--border)',
  borderRadius: 6, padding: '6px 10px', fontSize: 14,
  cursor: 'pointer', transition: 'color 0.2s',
};