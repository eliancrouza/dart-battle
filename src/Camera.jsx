import { useRef, useState, useEffect, useCallback } from 'react';

const SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

function calculateScore(px, py, cx, cy, scale) {
  const f = 1.5 * scale;
  const dx = px - cx, dy = py - cy;
  const distMm = Math.sqrt(dx * dx + dy * dy) / f;

  if (distMm <= 6.35)  return { score: 50, label: 'DOUBLE BULL', multiplier: 1 };
  if (distMm <= 15.9)  return { score: 25, label: 'BULL',         multiplier: 1 };
  if (distMm > 170)    return { score: 0,  label: 'HORS CIBLE',   multiplier: 1 };

  const angle = ((Math.atan2(dy, dx) * 180 / Math.PI + 90) % 360 + 360) % 360;
  const sv = SECTORS[Math.floor(((angle + 9) % 360) / 18)];

  if (distMm >= 99  && distMm <= 107) return { score: sv * 3, label: `T${sv}`, multiplier: 3 };
  if (distMm >= 162 && distMm <= 170) return { score: sv * 2, label: `D${sv}`, multiplier: 2 };
  return { score: sv, label: `${sv}`, multiplier: 1 };
}

export default function Camera({ onDartScored, disabled }) {
  const videoRef   = useRef(null);
  const refCanvas  = useRef(null);
  const displayRef = useRef(null);
  const streamRef  = useRef(null);
  const intervalRef = useRef(null);
  const autoRef    = useRef(false);

  const [cameraOn, setCameraOn]       = useState(false);
  const [status, setStatus]           = useState('idle');
  const [center, setCenter]           = useState({ x: 250, y: 250 });
  const [scale, setScale]             = useState(1.0);
  const [threshold, setThreshold]     = useState(50);
  const [lastResult, setLastResult]   = useState(null);
  const [autoMode, setAutoMode]       = useState(false);

  const W = 500, H = 500;

  useEffect(() => {
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraOn(true);
      } catch (err) { alert('Erreur caméra : ' + err.message); }
    };
    start();
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = refCanvas.current;
    if (!video || !canvas || !video.videoWidth) return null;
    canvas.width = W; canvas.height = H;
    canvas.getContext('2d').drawImage(video, 0, 0, W, H);
    return canvas.getContext('2d').getImageData(0, 0, W, H);
  }, []);

  const drawOverlay = useCallback((ctx, cx, cy, s) => {
    const radii  = [6.35, 15.9, 99, 107, 162, 170];
    const colors = ['#FF1744', '#00E676', 'rgba(255,255,255,0.4)', '#FF1744', 'rgba(255,255,255,0.4)', '#FF1744'];
    radii.forEach((r, i) => {
      ctx.beginPath(); ctx.arc(cx, cy, r * 1.5 * s, 0, 2 * Math.PI);
      ctx.strokeStyle = colors[i]; ctx.lineWidth = 1.5; ctx.stroke();
    });
    ctx.strokeStyle = '#00E5FF'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 40, cy); ctx.lineTo(cx + 40, cy);
    ctx.moveTo(cx, cy - 40); ctx.lineTo(cx, cy + 40);
    ctx.stroke();
  }, []);

  const calibrate = useCallback(() => {
    const frame = captureFrame();
    if (!frame) return;
    refCanvas.current._refData = frame;
    setStatus('calibrated');
    setLastResult(null);
    const canvas = displayRef.current;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, W, H);
    drawOverlay(ctx, center.x, center.y, scale);
  }, [captureFrame, drawOverlay, center, scale]);

  const analyze = useCallback(() => {
    if (!refCanvas.current?._refData) return;
    const current = captureFrame();
    if (!current) return;

    const ref = refCanvas.current._refData;
    const cx = center.x, cy = center.y;
    const canvas = displayRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = W; canvas.height = H;

    const output  = ctx.createImageData(W, H);
    const isGreen = new Uint8Array(W * H);
    let sumX = 0, sumY = 0, total = 0;

    for (let i = 0; i < ref.data.length; i += 4) {
      const diff =
        Math.abs(ref.data[i]   - current.data[i])   +
        Math.abs(ref.data[i+1] - current.data[i+1]) +
        Math.abs(ref.data[i+2] - current.data[i+2]);
      const idx = i / 4;
      const px  = idx % W, py = Math.floor(idx / W);
      if (diff > threshold && (px-cx)**2 + (py-cy)**2 > 15*15) {
        output.data[i]=0; output.data[i+1]=220; output.data[i+2]=80; output.data[i+3]=200;
        isGreen[idx]=1; sumX+=px; sumY+=py; total++;
      } else {
        output.data[i]   = current.data[i]   * 0.4;
        output.data[i+1] = current.data[i+1] * 0.4;
        output.data[i+2] = current.data[i+2] * 0.4;
        output.data[i+3] = 255;
      }
    }

    ctx.putImageData(output, 0, 0);
    drawOverlay(ctx, cx, cy, scale);

    if (total < 30) { setStatus('calibrated'); return; }

    const bx = sumX / total, by = sumY / total;
    let tipX = bx, tipY = by, minD = Infinity;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!isGreen[y*W+x]) continue;
      if ((x-bx)**2+(y-by)**2 > 100*100) continue;
      const d = (x-cx)**2+(y-cy)**2;
      if (d < minD) { minD=d; tipX=x; tipY=y; }
    }

    ctx.fillStyle='#FFD600'; ctx.beginPath(); ctx.arc(bx,by,7,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#000'; ctx.lineWidth=1; ctx.stroke();
    ctx.strokeStyle='#FF1744'; ctx.lineWidth=3;
    ctx.beginPath();
    ctx.moveTo(tipX-12,tipY-12); ctx.lineTo(tipX+12,tipY+12);
    ctx.moveTo(tipX+12,tipY-12); ctx.lineTo(tipX-12,tipY+12);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(tipX,tipY,16,0,2*Math.PI);
    ctx.strokeStyle='#FF6EC7'; ctx.lineWidth=2; ctx.stroke();

    const result = calculateScore(tipX, tipY, cx, cy, scale);
    setLastResult(result);
    setStatus('hit');
    refCanvas.current._refData = current;
    if (onDartScored && !disabled) onDartScored(result);
    if (autoRef.current) stopAuto();
  }, [captureFrame, drawOverlay, center, scale, threshold, onDartScored, disabled]);

  const stopAuto = () => {
    autoRef.current = false;
    setAutoMode(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const startAuto = () => {
    if (!refCanvas.current?._refData) { alert('Calibre d\'abord !'); return; }
    autoRef.current = true;
    setAutoMode(true);
    intervalRef.current = setInterval(analyze, 2000);
  };

  const handleCanvasClick = (e) => {
    const canvas = displayRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / rect.width);
    const y = (e.clientY - rect.top)  * (H / rect.height);
    setCenter({ x, y });
    if (status !== 'idle') {
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, W, H);
      drawOverlay(ctx, x, y, scale);
    }
  };

  const resultColor = !lastResult ? '#fff'
    : lastResult.score === 50 ? '#FF1744'
    : lastResult.score === 25 ? '#00E676'
    : lastResult.score === 0  ? '#666'
    : lastResult.multiplier === 3 ? '#FF9100'
    : lastResult.multiplier === 2 ? '#2979FF'
    : '#fff';

  const btnStyle = (color, disabled) => ({
    padding: '10px 0', background: 'transparent',
    border: `1.5px solid ${disabled ? '#333' : color}`,
    borderRadius: 6, color: disabled ? '#333' : color,
    fontWeight: 700, fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer',
  });

  return (
    <div>
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ display: 'none' }} />
        <canvas ref={displayRef} onClick={handleCanvasClick} style={{
          width: '100%', maxWidth: 500, display: 'block', borderRadius: 8,
          cursor: 'crosshair', border: autoMode ? '2px solid #00E676' : '2px solid #222'
        }} />
        <canvas ref={refCanvas} style={{ display: 'none' }} />

        {lastResult && (
          <div style={{
            position: 'absolute', top: 10, left: 10,
            background: 'rgba(0,0,0,0.85)', border: `2px solid ${resultColor}`,
            borderRadius: 8, padding: '6px 14px', color: resultColor, fontFamily: 'monospace', fontWeight: 900
          }}>
            <span style={{ fontSize: 11, opacity: 0.7, display: 'block' }}>IMPACT</span>
            <span style={{ fontSize: 22 }}>{lastResult.label}</span>
            <span style={{ fontSize: 18, marginLeft: 8 }}>+{lastResult.score}</span>
          </div>
        )}
        {autoMode && (
          <div style={{
            position: 'absolute', top: 10, right: 10,
            background: 'rgba(0,200,100,0.2)', border: '1px solid #00E676',
            borderRadius: 6, padding: '4px 10px', color: '#00E676', fontSize: 11, fontWeight: 700
          }}>● DÉTECTION AUTO</div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <button onClick={calibrate} disabled={!cameraOn} style={btnStyle('#FF9100', !cameraOn)}>
          📸 Calibrer
        </button>
        <button onClick={autoMode ? stopAuto : startAuto}
          disabled={status === 'idle' || disabled}
          style={btnStyle(autoMode ? '#FF1744' : '#00E676', status === 'idle' || disabled)}>
          {autoMode ? '⏹ Stop auto' : '▶ Détection auto'}
        </button>
        <button onClick={analyze} disabled={status === 'idle' || disabled || autoMode}
          style={btnStyle('#2979FF', status === 'idle' || disabled || autoMode)}>
          🎯 Analyser
        </button>
        <button onClick={calibrate} disabled={!cameraOn} style={btnStyle('#9C27B0', !cameraOn)}>
          🔄 Reset référence
        </button>
      </div>

      <details style={{ background: '#111', borderRadius: 8, padding: 10, marginBottom: 8 }}>
        <summary style={{ cursor: 'pointer', fontSize: 12, color: '#555', userSelect: 'none' }}>
          ⚙️ Réglages avancés
        </summary>
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 12, color: '#aaa' }}>Zoom cercles : {scale}</label>
          <input type="range" min="0.5" max="2.5" step="0.05" value={scale}
            onChange={e => setScale(Number(e.target.value))} style={{ width: '100%' }} />
          <label style={{ fontSize: 12, color: '#aaa', marginTop: 8, display: 'block' }}>Sensibilité : {threshold}</label>
          <input type="range" min="10" max="150" value={threshold}
            onChange={e => setThreshold(Number(e.target.value))} style={{ width: '100%' }} />
          <p style={{ fontSize: 11, color: '#444', marginTop: 8 }}>
            📍 Clique sur l'image pour repositionner la croix cyan sur le bullseye
          </p>
        </div>
      </details>

      {disabled && (
        <div style={{ textAlign: 'center', color: '#555', fontSize: 13, padding: 8, background: '#111', borderRadius: 6 }}>
          ⏳ Ce n'est pas ton tour
        </div>
      )}
    </div>
  );
}