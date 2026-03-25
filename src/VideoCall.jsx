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

export default function VideoCall({ roomCode, user, players }) {
  const localRef      = useRef(null);
  const remoteRefs    = useRef({});
  const pcRefs        = useRef({});
  const localStream   = useRef(null);

  const [expanded, setExpanded]   = useState(false);
  const [muted, setMuted]         = useState(false);
  const [camOff, setCamOff]       = useState(false);
  const [status, setStatus]       = useState('idle'); // idle | connecting | connected

  const callDocId = (uid1, uid2) =>
    [uid1, uid2].sort().join('_');

  useEffect(() => {
    startLocal();
    return () => cleanup();
  }, []);

  // Quand les joueurs changent, initier les connexions
  useEffect(() => {
    if (!localStream.current) return;
    const others = players.filter(p => p.uid !== user.uid);
    others.forEach(p => initConnection(p.uid));
  }, [players.length]);

  const startLocal = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStream.current = stream;
      if (localRef.current) localRef.current.srcObject = stream;
      setStatus('connecting');
      const others = players.filter(p => p.uid !== user.uid);
      others.forEach(p => initConnection(p.uid));
    } catch (err) {
      console.error('Erreur caméra visio:', err);
    }
  };

  const initConnection = async (remoteUid) => {
    if (pcRefs.current[remoteUid]) return;
    const pc = new RTCPeerConnection(servers);
    pcRefs.current[remoteUid] = pc;

    // Ajouter le stream local
    localStream.current.getTracks().forEach(track => {
      pc.addTrack(track, localStream.current);
    });

    // Recevoir le stream distant
    pc.ontrack = (e) => {
      setStatus('connected');
      if (remoteRefs.current[remoteUid]) {
        remoteRefs.current[remoteUid].srcObject = e.streams[0];
      }
    };

    const docId  = callDocId(user.uid, remoteUid);
    const callRef = doc(db, 'calls', roomCode, 'peers', docId);
    const snap    = await getDoc(callRef);

    if (user.uid < remoteUid) {
      // Je suis le "caller" — je crée l'offer
      const offerCandidates  = collection(callRef, 'offerCandidates');
      const answerCandidates = collection(callRef, 'answerCandidates');

      pc.onicecandidate = (e) => {
        if (e.candidate) addDoc(offerCandidates, e.candidate.toJSON());
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await setDoc(callRef, { offer: { sdp: offer.sdp, type: offer.type } });

      // Écouter la réponse
      onSnapshot(callRef, (snap) => {
        const data = snap.data();
        if (data?.answer && !pc.currentRemoteDescription) {
          pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
      });

      // Écouter les ICE candidates de l'autre
      onSnapshot(answerCandidates, (snap) => {
        snap.docChanges().forEach(change => {
          if (change.type === 'added')
            pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
        });
      });

    } else {
      // Je suis le "callee" — j'attends l'offer
      const offerCandidates  = collection(callRef, 'offerCandidates');
      const answerCandidates = collection(callRef, 'answerCandidates');

      pc.onicecandidate = (e) => {
        if (e.candidate) addDoc(answerCandidates, e.candidate.toJSON());
      };

      // Écouter l'offer
      onSnapshot(callRef, async (snap) => {
        const data = snap.data();
        if (data?.offer && !pc.currentRemoteDescription) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await updateDoc(callRef, { answer: { sdp: answer.sdp, type: answer.type } });
        }
      });

      // Écouter les ICE candidates du caller
      onSnapshot(offerCandidates, (snap) => {
        snap.docChanges().forEach(change => {
          if (change.type === 'added')
            pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
        });
      });
    }
  };

  const toggleMute = () => {
    if (!localStream.current) return;
    localStream.current.getAudioTracks().forEach(t => t.enabled = !t.enabled);
    setMuted(m => !m);
  };

  const toggleCam = () => {
    if (!localStream.current) return;
    localStream.current.getVideoTracks().forEach(t => t.enabled = !t.enabled);
    setCamOff(c => !c);
  };

  const cleanup = () => {
    Object.values(pcRefs.current).forEach(pc => pc.close());
    if (localStream.current) localStream.current.getTracks().forEach(t => t.stop());
  };

  const others = players.filter(p => p.uid !== user.uid);

  return (
    <div style={{
      position: 'fixed',
      bottom: 16, right: 16,
      zIndex: 50,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8,
    }}>
      {/* Vidéos distantes */}
      {expanded && others.map(p => (
        <div key={p.uid} style={s.videoWrap}>
          <video
            ref={el => remoteRefs.current[p.uid] = el}
            autoPlay playsInline
            style={s.video}
          />
          <div style={s.videoLabel}>
            <span>{p.avatar}</span>
            <span style={{ fontSize: 11 }}>{p.name}</span>
          </div>
        </div>
      ))}

      {/* Ma vidéo */}
      {expanded && (
        <div style={s.videoWrap}>
          <video ref={localRef} autoPlay playsInline muted style={s.video} />
          <div style={s.videoLabel}>
            <span>🎯</span>
            <span style={{ fontSize: 11 }}>Moi</span>
          </div>
        </div>
      )}

      {/* Barre de contrôles */}
      <div style={s.controls}>
        <button onClick={toggleMute} style={s.ctrlBtn} title={muted ? 'Activer micro' : 'Couper micro'}>
          {muted ? '🔇' : '🎤'}
        </button>
        <button onClick={toggleCam} style={s.ctrlBtn} title={camOff ? 'Activer caméra' : 'Couper caméra'}>
          {camOff ? '📵' : '📹'}
        </button>
        <button onClick={() => setExpanded(e => !e)} style={{
          ...s.ctrlBtn,
          background: expanded ? 'rgba(255,145,0,0.2)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${expanded ? '#FF9100' : '#333'}`,
          position: 'relative',
        }}>
          {expanded ? '✕' : '📞'}
          {status === 'connected' && !expanded && (
            <span style={{
              position: 'absolute', top: -3, right: -3,
              width: 8, height: 8, borderRadius: '50%',
              background: '#00E676', border: '1px solid #080808',
            }} />
          )}
        </button>
      </div>
    </div>
  );
}

const s = {
  videoWrap: {
    position: 'relative', width: 120, height: 90,
    borderRadius: 10, overflow: 'hidden',
    border: '1px solid #333', background: '#111',
  },
  video: {
    width: '100%', height: '100%', objectFit: 'cover',
  },
  videoLabel: {
    position: 'absolute', bottom: 4, left: 6,
    display: 'flex', alignItems: 'center', gap: 4,
    color: '#fff', textShadow: '0 1px 3px #000',
  },
  controls: {
    display: 'flex', gap: 8,
    background: 'rgba(14,14,18,0.95)',
    border: '1px solid #1e1e28',
    borderRadius: 12, padding: '8px 10px',
    backdropFilter: 'blur(10px)',
  },
  ctrlBtn: {
    width: 40, height: 40, borderRadius: 8,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid #333', fontSize: 18,
    cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
  },
};