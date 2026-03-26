// Export functions: composite card to canvas, export as PNG or MP4/WebM video
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

const EXPORT_SIZE = 1080;

const LAYOUT = {
  padding: 0.06,
  photo: { top: 0.06, width: 0.62, aspectRatio: 4 / 3.2 },
  prefix: { top: 0.60, size: 0.032, weight: '500' },
  title: { top: 0.645, size: 0.058, weight: '700' },
  category: { top: 0.72, size: 0.026, weight: '400', letterSpacing: 4 },
  name: { top: 0.80, size: 0.055, weight: '700', lineHeight: 1.05 },
  logo: { bottom: 0.05, right: 0.06, width: 0.18 },
  logoText: { size: 0.016 },
};

// Pre-load the real AICP logo SVG
let logoImage = null;
const logoImg = new Image();
logoImg.onload = () => { logoImage = logoImg; };
logoImg.src = '/aicp-logo.svg';

// --- Video support detection ---

function detectVideoSupport() {
  if (typeof VideoEncoder !== 'undefined') return 'mp4-encoder';
  if (typeof MediaRecorder !== 'undefined') {
    if (MediaRecorder.isTypeSupported('video/mp4')) return 'mp4-recorder';
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) return 'webm-vp9';
    if (MediaRecorder.isTypeSupported('video/webm')) return 'webm';
  }
  return null;
}

export const videoSupport = detectVideoSupport();

export const videoFormatLabel = (() => {
  if (!videoSupport) return null;
  if (videoSupport.startsWith('mp4')) return 'MP4';
  return 'WebM';
})();

// --- iOS-safe download ---

function downloadBlob(blob, filename) {
  const file = new File([blob], filename, { type: blob.type });

  // Mobile: try native share sheet (save to files, share to LinkedIn, etc.)
  if (navigator.share && navigator.canShare) {
    try {
      if (navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file] }).catch(() => {
          // User cancelled share — fall through to download
          fallbackDownload(blob, filename);
        });
        return;
      }
    } catch (_) {
      // canShare threw — fall through
    }
  }

  fallbackDownload(blob, filename);
}

function fallbackDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Delay revocation so browser has time to start the download
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// --- Card drawing (shared by all export paths) ---

function getPhotoElement() {
  const uploaded = document.getElementById('uploaded-photo');
  if (uploaded && uploaded.style.display !== 'none' && uploaded.src) return uploaded;
  const photoCanvas = document.getElementById('photo-canvas');
  if (photoCanvas && photoCanvas.style.display !== 'none') return photoCanvas;
  return null;
}

function drawCard(ctx, bgCanvas, state) {
  const S = EXPORT_SIZE;
  const pad = S * LAYOUT.padding;

  ctx.drawImage(bgCanvas, 0, 0, S, S);

  const photoEl = getPhotoElement();
  if (photoEl) {
    const pw = S * LAYOUT.photo.width;
    const ph = pw / LAYOUT.photo.aspectRatio;
    const px = (S - pw) / 2;
    const py = S * LAYOUT.photo.top;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = pw;
    tempCanvas.height = ph;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.filter = 'grayscale(1)';

    const srcW = photoEl.videoWidth || photoEl.naturalWidth || photoEl.width;
    const srcH = photoEl.videoHeight || photoEl.naturalHeight || photoEl.height;
    const srcAspect = srcW / srcH;
    const dstAspect = pw / ph;
    let sx = 0, sy = 0, sw, sh;
    if (srcAspect > dstAspect) {
      sh = srcH; sw = sh * dstAspect; sx = (srcW - sw) / 2;
    } else {
      sw = srcW; sh = sw / dstAspect; sy = (srcH - sh) / 2;
    }
    tempCtx.drawImage(photoEl, sx, sy, sw, sh, 0, 0, pw, ph);
    ctx.drawImage(tempCanvas, px, py);
  }

  ctx.fillStyle = 'white';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  ctx.font = `${LAYOUT.prefix.weight} ${S * LAYOUT.prefix.size}px Bebas Neue`;
  ctx.globalAlpha = 0.9;
  ctx.fillText(state.prefix, pad, S * LAYOUT.prefix.top);
  ctx.globalAlpha = 1.0;

  ctx.font = `${LAYOUT.title.weight} ${S * LAYOUT.title.size}px Bebas Neue`;
  ctx.fillText(state.title, pad, S * LAYOUT.title.top);

  ctx.font = `${LAYOUT.category.weight} ${S * LAYOUT.category.size}px Fira Mono`;
  ctx.globalAlpha = 0.7;
  const categoryText = state.category.toUpperCase();
  let cx = pad;
  for (let i = 0; i < categoryText.length; i++) {
    ctx.fillText(categoryText[i], cx, S * LAYOUT.category.top);
    cx += ctx.measureText(categoryText[i]).width + LAYOUT.category.letterSpacing;
  }
  ctx.globalAlpha = 1.0;

  ctx.font = `${LAYOUT.name.weight} ${S * LAYOUT.name.size}px Bebas Neue`;
  const nameY = S * LAYOUT.name.top;
  ctx.fillText(state.firstName.toUpperCase() || 'YOUR', pad, nameY);
  ctx.fillText(state.lastName.toUpperCase() || 'NAME', pad, nameY + S * LAYOUT.name.size * LAYOUT.name.lineHeight);

  drawLogo(ctx, S, state.showType);
}

function drawLogo(ctx, S) {
  if (!logoImage) return;
  const logoW = S * LAYOUT.logo.width;
  const logoH = logoW / 3.54;
  const lx = S - S * LAYOUT.logo.right - logoW;
  const ly = S - S * LAYOUT.logo.bottom - logoH - S * 0.03;
  ctx.drawImage(logoImage, lx, ly, logoW, logoH);
  ctx.font = `500 ${S * LAYOUT.logoText.size}px Bebas Neue`;
  ctx.fillStyle = 'white';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText('NOT AWARDS 2026', S - S * LAYOUT.logo.right, ly + logoH + S * 0.008);
  ctx.textAlign = 'left';
}

// --- PNG Export ---

export function exportPNG(bgCanvas, state) {
  const canvas = document.createElement('canvas');
  canvas.width = EXPORT_SIZE;
  canvas.height = EXPORT_SIZE;
  const ctx = canvas.getContext('2d');
  drawCard(ctx, bgCanvas, state);

  canvas.toBlob((blob) => {
    downloadBlob(blob, `aicp-not-a-judge-${state.firstName || 'export'}.png`);
  }, 'image/png');
}

// --- Tier 1: MP4 via VideoEncoder + mp4-muxer (Chrome/Edge) ---

async function exportVideoMP4Encoder(bgCanvas, shaderRender, state, onProgress) {
  const canvas = document.createElement('canvas');
  canvas.width = EXPORT_SIZE;
  canvas.height = EXPORT_SIZE;
  const ctx = canvas.getContext('2d');

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width: EXPORT_SIZE, height: EXPORT_SIZE },
    fastStart: 'in-memory',
  });

  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { throw new Error('VideoEncoder error: ' + e.message); },
  });

  encoder.configure({
    codec: 'avc1.640028',
    width: EXPORT_SIZE,
    height: EXPORT_SIZE,
    bitrate: 8_000_000,
    framerate: 30,
  });

  const totalFrames = 180;
  let shaderTime = performance.now() / 1000;

  for (let i = 0; i < totalFrames; i++) {
    shaderTime += 1 / 30;
    shaderRender(shaderTime);
    drawCard(ctx, bgCanvas, state);

    const frame = new VideoFrame(canvas, { timestamp: (i / 30) * 1_000_000 });
    encoder.encode(frame, { keyFrame: i % 30 === 0 });
    frame.close();

    if (onProgress) onProgress(i / totalFrames);
    if (i % 5 === 0) await new Promise(r => setTimeout(r, 0));
  }

  await encoder.flush();
  muxer.finalize();

  const blob = new Blob([target.buffer], { type: 'video/mp4' });
  downloadBlob(blob, `aicp-not-a-judge-${state.firstName || 'export'}.mp4`);
}

// --- Tier 2: MP4 via MediaRecorder (Safari desktop + iOS) ---

function exportVideoMP4Recorder(bgCanvas, shaderRender, state, onProgress) {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = EXPORT_SIZE;
      canvas.height = EXPORT_SIZE;
      const ctx = canvas.getContext('2d');

      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/mp4',
        videoBitsPerSecond: 8000000,
      });

      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onerror = (e) => reject(new Error('MediaRecorder error: ' + e.error));

      recorder.onstop = () => {
        try {
          const blob = new Blob(chunks, { type: 'video/mp4' });
          downloadBlob(blob, `aicp-not-a-judge-${state.firstName || 'export'}.mp4`);
          resolve();
        } catch (err) {
          reject(err);
        }
      };

      const duration = 6000;
      const startTime = performance.now();
      let shaderTime = performance.now() / 1000;

      recorder.start(1000); // Request data every 1s for smoother progress

      function renderLoop() {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        if (onProgress) onProgress(progress);

        shaderTime += 1 / 30;
        shaderRender(shaderTime);
        drawCard(ctx, bgCanvas, state);

        if (elapsed < duration) {
          requestAnimationFrame(renderLoop);
        } else {
          recorder.stop();
        }
      }
      renderLoop();
    } catch (err) {
      reject(err);
    }
  });
}

// --- Tier 3: WebM via MediaRecorder (Firefox) ---

function exportVideoWebM(bgCanvas, shaderRender, state, onProgress) {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = EXPORT_SIZE;
      canvas.height = EXPORT_SIZE;
      const ctx = canvas.getContext('2d');

      const stream = canvas.captureStream(30);

      // Pick the best supported WebM codec
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 8000000,
      });

      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onerror = (e) => reject(new Error('MediaRecorder error: ' + e.error));

      recorder.onstop = () => {
        try {
          const blob = new Blob(chunks, { type: 'video/webm' });
          downloadBlob(blob, `aicp-not-a-judge-${state.firstName || 'export'}.webm`);
          resolve();
        } catch (err) {
          reject(err);
        }
      };

      const duration = 6000;
      const startTime = performance.now();
      let shaderTime = performance.now() / 1000;

      recorder.start(1000);

      function renderLoop() {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        if (onProgress) onProgress(progress);

        shaderTime += 1 / 30;
        shaderRender(shaderTime);
        drawCard(ctx, bgCanvas, state);

        if (elapsed < duration) {
          requestAnimationFrame(renderLoop);
        } else {
          recorder.stop();
        }
      }
      renderLoop();
    } catch (err) {
      reject(err);
    }
  });
}

// --- Main export dispatcher ---

export async function exportVideo(bgCanvas, shaderRender, state, onProgress) {
  switch (videoSupport) {
    case 'mp4-encoder':
      await exportVideoMP4Encoder(bgCanvas, shaderRender, state, onProgress);
      break;
    case 'mp4-recorder':
      await exportVideoMP4Recorder(bgCanvas, shaderRender, state, onProgress);
      break;
    case 'webm-vp9':
    case 'webm':
      await exportVideoWebM(bgCanvas, shaderRender, state, onProgress);
      break;
    default:
      throw new Error('Video export is not supported in this browser.');
  }
}
