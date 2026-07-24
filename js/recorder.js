// 무대 영상 촬영 — 캔버스 화면을 WebM 영상으로 녹화한다.
// 카운트다운(3·2·1) → 녹화 → 일시정지/다시 녹화/정지 → 미리보기 후 다운로드.
// 브라우저 표준 MediaRecorder + canvas.captureStream() 만 사용해 외부 라이브러리가 없다.

// 이 브라우저가 지원하는 WebM 코덱 중 가장 좋은 것을 고른다
function pickMimeType() {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const m of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return '';
}

export function isRecordingSupported(canvas) {
  return typeof MediaRecorder !== 'undefined' && typeof canvas?.captureStream === 'function';
}

// audioEls: 녹화에 함께 담고 싶은 <audio> 엘리먼트들 (지원 브라우저에서만)
export function createRecorder({ canvas, fps = 30, audioEls = [], onTick, onState }) {
  let rec = null;
  let chunks = [];
  let stream = null;
  let extraStreams = [];
  let timer = null;
  let startedAt = 0;
  let pausedTotal = 0;
  let pausedAt = 0;
  let state = 'idle'; // idle | countdown | recording | paused
  let onDone = null;

  const setState = (s) => { state = s; onState?.(s); };
  const elapsed = () => {
    if (!startedAt) return 0;
    const now = state === 'paused' ? pausedAt : Date.now();
    return Math.max(0, now - startedAt - pausedTotal);
  };

  function buildStream() {
    const s = canvas.captureStream(fps);
    extraStreams = [];
    // 음악·환경음을 함께 담는다 (captureStream 미지원 브라우저는 영상만 녹화)
    for (const el of audioEls) {
      try {
        const as = el?.captureStream?.() || el?.mozCaptureStream?.();
        if (!as) continue;
        extraStreams.push(as);
        as.getAudioTracks().forEach(tr => s.addTrack(tr));
      } catch { /* 이 소리는 녹화에 담지 않음 */ }
    }
    return s;
  }

  function stopTracks() {
    try { stream?.getTracks().forEach(t => t.stop()); } catch { /* 이미 정리됨 */ }
    stream = null; extraStreams = [];
  }

  return {
    getState: () => state,
    getElapsed: elapsed,

    // 3·2·1 카운트다운 후 녹화 시작. onCount(n) 으로 숫자를 알려준다.
    async startWithCountdown({ onCount, seconds = 3 } = {}) {
      if (state !== 'idle') return false;
      setState('countdown');
      for (let n = seconds; n >= 1; n--) {
        onCount?.(n);
        await new Promise(r => setTimeout(r, 900));
        if (state !== 'countdown') return false; // 도중에 취소됨
      }
      onCount?.(0); // "시작!"
      await new Promise(r => setTimeout(r, 350));
      if (state !== 'countdown') return false;
      return this.start();
    },

    start() {
      if (state === 'recording') return false;
      try {
        chunks = [];
        stream = buildStream();
        const mimeType = pickMimeType();
        rec = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 6_000_000 } : undefined);
        rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = () => {
          stopTracks();
          const blob = new Blob(chunks, { type: (rec?.mimeType || 'video/webm').split(';')[0] });
          chunks = [];
          const ms = elapsed();
          startedAt = 0; pausedTotal = 0; pausedAt = 0;
          setState('idle');
          onDone?.({ blob, url: URL.createObjectURL(blob), durationMs: ms });
          onDone = null;
        };
        rec.start(250); // 250ms 단위로 데이터를 모아 긴 녹화도 안전하게
        startedAt = Date.now(); pausedTotal = 0; pausedAt = 0;
        setState('recording');
        timer = setInterval(() => onTick?.(elapsed()), 200);
        return true;
      } catch (e) {
        stopTracks(); setState('idle');
        return false;
      }
    },

    pause() {
      if (state !== 'recording' || !rec) return;
      try { rec.pause(); } catch { return; }
      pausedAt = Date.now();
      setState('paused');
    },

    resume() {
      if (state !== 'paused' || !rec) return;
      try { rec.resume(); } catch { return; }
      pausedTotal += Date.now() - pausedAt; pausedAt = 0;
      setState('recording');
    },

    // 정지하면 onDone 콜백으로 미리보기용 blob/url 을 넘겨준다
    stop(done) {
      if (state === 'countdown') { setState('idle'); return; } // 카운트다운 중 취소
      if (!rec || (state !== 'recording' && state !== 'paused')) return;
      onDone = done;
      clearInterval(timer); timer = null;
      try { rec.stop(); } catch { stopTracks(); setState('idle'); }
    },

    cancelCountdown() { if (state === 'countdown') setState('idle'); },
  };
}

export function formatDuration(ms) {
  const total = Math.floor(ms / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}
