import { useEffect, useRef, useState } from 'react';
import { db } from './firebase';
import {
  doc, collection, addDoc, onSnapshot,
  setDoc, getDoc, updateDoc
} from 'firebase/firestore';

const servers = {
  iceServers: [
    { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }
  ]
};

export default function VideoCall({ roomCode, user, players, currentTurn }) {
  const localRef     = useRef(null);
  const remoteRefs   = useRef({});
  const pcRefs       = useRef({});
  const localStream  = useRef(null);

  const [expanded, setExpanded] = useState(false);
  const [muted, setMuted]       = useState(false);
  const [camOff, setCamOff]     = useState(false);
  const [status, setStatus]     = useState('idle');

  const callDocId = (uid1, uid2) => [uid1, uid2].sort().join('_');

  useEffect(() => {
    startLocal();
    return () => cleanup();
  }, []);

  useEffect(() => {
    if (!localStream.current) return;
    players.filter(p => p.uid !== user.uid).forEach(p => initConnection(p.uid));
  }, [players.length]);

  const startLocal = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStream.current = stream;
      if (localRef.current) localRef.current.srcObject = stream;
      setStatus('connecting');
      players.filter(p => p.uid !== user.uid).forEach(p => initConnection(p.uid));
    } catch (err) { console.error('Erreur visio:', err); }
  };

  const initConnection = async (remoteUid) => {
    if (pcRefs.current[remoteUid]) return;
    const pc = new RTCPeerConnection(servers);
    pcRefs.current[remoteUid] = pc;

    localStream.current.getTracks().forEach(track => pc.addTrack(track, localStream.current));

    pc.ontrack = (e) => {
      setStatus('connected');
      if (remoteRefs.current[remoteUid])
        remoteRefs.current[remoteUid].srcObject = e.streams[0];
    };

    const docId   = callDocId(user.uid, remoteUid);
    const callRef = doc(db, 'calls', roomCode, 'peers', docId);

    if (user.uid < remoteUid) {
      const offerCandidates  = collection(callRef, 'offerCandidates');
      const answerCandidates = collection(callRef, 'answerCandidates');
      pc.onicecandidate = (e) => { if (e.candidate) addDoc(offerCandidates, e.candidate.toJSON()); };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await setDoc(callRef, { offer: { sdp: offer.sdp, type: offer.type } });
      onSnapshot(callRef, (snap) => {
        const data = snap.data();
        if (data?.answer && !pc.currentRemoteDescription)
          pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      });
      onSnapshot(answerCandidates, (snap) => {
        snap.docChanges().forEach(c => {
          if (c.type === 'added') pc.addIceCandidate(new RTCIceCandidate(c.doc.data()));
        });
      });
    } else {
      const offerCandidates  = collection(callRef, 'offerCandidates');
      const answerCandidates = collection(callRef, 'answerCandidates');
      pc.onicecandidate = (e) => { if (e.candidate) addDoc(answerCandidates, e.candidate.toJSON()); };
      onSnapshot(callRef, async (snap) => {
        const data = snap.data();
        if (data?.offer && !pc.currentRemoteDescription) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await updateDoc(callRef, { answer: { sdp: answer.sdp, type: answer.type } });
        }
      });
      onSnapshot(offerCandidates, (snap) => {
        snap.docChanges().forEach(c => {
          if (c.type === 'added') pc.addIceCandidate(new RTCIceCandidate(c.doc.data()));
        });
      });
    }
  };

  const toggleMute = () => {
    localStream.current?.getAudioTracks().forEach(t => t.enabled = !t.enabled);
    setMuted(m => !m);
  };

  const toggleCam = () => {
    localStream.current?.getVideoTracks().forEach(t => t.enabled = !t.enabled);
    setCamOff(c => !c);
  };

  const cleanup = () => {
    Object.values(pcRefs.current).forEach(pc => pc.close());
    localStream.current?.getTracks().forEach(t => t.stop());
  };

  const others      = players.filter(p => p.uid !== user.uid);
  const activePlayer = players.find(p => p.uid === currentTurn);
  const isMyTurn    = currentTurn === user.uid;

  // Qui est en grand ? Le joueur dont c'est le tour
  const bigUid = currentTurn;

  if (!expanded) {
    return (
      <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 50 }}>
        <button onClick={() => setExpanded(true)} style={{
          width: 48, height: 48, borderRadius: 12,
          background: 'rgba(14,14,18,0.95)', border: `1px solid ${status === 'connected' ? '#00E676' : '#333'}`,
          fontSize: 22, cursor: 'pointer', position: 'relative',
          backdropFilter: 'blur(10px)',
        }}>
          📞
          {status === 'connected' && (
            <span style={{ position: 'absolute', top: -3, right: -3, width: 10, height: 10, borderRadius: '50%', background: '#00E676', border: '2px solid #080808' }} />
          )}
        </button>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.96)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: "'Bebas Neue'", fontSize: 20, letterSpacing: 3, color: '#FF9100' }}>DART BATTLE</span>
          <span style={{ background: '#1a1a1a', borderRadius: 6, padding: '2px 8px', fontSize: 11, color: '#555' }}>{roomCode}</span>
        </div>
        <button onClick={() => setExpanded(false)} style={{ background: 'none', border: '1px solid #333', color: '#888', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>
          Réduire
        </button>
      </div>

      {/* Vidéo principale — joueur actif */}
      <div style={{ flex: 1, position: 'relative', background: '#0a0a0a', overflow: 'hidden' }}>
        {/* Vidéo du joueur actif */}
        {isMyTurn ? (
          <video ref={localRef} autoPlay playsInline muted
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
        ) : (
          <video
            ref={el => remoteRefs.current[bigUid] = el}
            autoPlay playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}

        {/* Overlay infos joueur actif */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
          padding: '40px 16px 16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 28 }}>{activePlayer?.avatar}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>
                {isMyTurn ? 'Moi' : activePlayer?.name}
                <span style={{ marginLeft: 8, fontSize: 12, color: '#FF9100', fontWeight: 600 }}>🏹 En train de jouer</span>
              </div>
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: 28, color: activePlayer?.color || '#FF9100', letterSpacing: 2 }}>
                {players.find(p => p.uid === bigUid)?.score} pts
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Vignettes des autres joueurs */}
      <div style={{
        display: 'flex', gap: 8, padding: '10px 12px',
        background: '#0d0d0d', borderTop: '1px solid #1a1a1a',
        overflowX: 'auto',
      }}>
        {/* Ma vignette si c'est pas mon tour */}
        {!isMyTurn && (
          <div style={s.thumb}>
            <video ref={localRef} autoPlay playsInline muted style={{ ...s.thumbVideo, transform: 'scaleX(-1)' }} />
            <div style={s.thumbLabel}>
              <span>🎯</span><span>Moi</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, marginLeft: 'auto', color: '#FF9100' }}>
                {players.find(p => p.uid === user.uid)?.score}
              </span>
            </div>
          </div>
        )}

        {/* Vignettes des autres (sauf le joueur actif) */}
        {others.filter(p => p.uid !== bigUid).map(p => (
          <div key={p.uid} style={s.thumb}>
            <video
              ref={el => {
                // Si c'est pas le joueur actif, la ref va dans la vignette
                if (p.uid !== bigUid) remoteRefs.current[p.uid] = el;
              }}
              autoPlay playsInline
              style={s.thumbVideo}
            />
            <div style={s.thumbLabel}>
              <span>{p.avatar}</span>
              <span style={{ fontSize: 11, maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, marginLeft: 'auto', color: p.color || '#888' }}>
                {p.score}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Contrôles */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, padding: '12px 16px', background: '#080808', borderTop: '1px solid #111' }}>
        <button onClick={toggleMute} style={{ ...s.ctrl, borderColor: muted ? '#FF1744' : '#333', color: muted ? '#FF1744' : '#888' }}>
          {muted ? '🔇' : '🎤'}
          <span style={{ fontSize: 10, display: 'block' }}>{muted ? 'Muet' : 'Micro'}</span>
        </button>
        <button onClick={toggleCam} style={{ ...s.ctrl, borderColor: camOff ? '#FF1744' : '#333', color: camOff ? '#FF1744' : '#888' }}>
          {camOff ? '📵' : '📹'}
          <span style={{ fontSize: 10, display: 'block' }}>{camOff ? 'Cam off' : 'Caméra'}</span>
        </button>
        <button onClick={() => setExpanded(false)} style={{ ...s.ctrl, borderColor: '#FF9100', color: '#FF9100' }}>
          🎯
          <span style={{ fontSize: 10, display: 'block' }}>Jeu</span>
        </button>
      </div>
    </div>
  );
}

const s = {
  thumb: {
    flex: '0 0 auto', width: 120,
    background: '#111', borderRadius: 10,
    overflow: 'hidden', border: '1px solid #1a1a1a',
  },
  thumbVideo: {
    width: '100%', height: 80, objectFit: 'cover', display: 'block',
  },
  thumbLabel: {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '4px 6px', fontSize: 11, color: '#888',
  },
  ctrl: {
    width: 56, height: 56, borderRadius: 12,
    background: 'rgba(255,255,255,0.03)', border: '1px solid',
    cursor: 'pointer', fontSize: 20,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
};