// Export functions: composite card to canvas, export as PNG or MP4 video
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

const EXPORT_SIZE = 1080;

// Layout constants (as fractions of EXPORT_SIZE)
const LAYOUT = {
  padding: 0.06,
  photo: {
    top: 0.06,
    width: 0.62,
    aspectRatio: 4 / 3.2,
  },
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

  // 1. Draw WebGL background
  ctx.drawImage(bgCanvas, 0, 0, S, S);

  // 2. Draw photo
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
      sh = srcH;
      sw = sh * dstAspect;
      sx = (srcW - sw) / 2;
    } else {
      sw = srcW;
      sh = sw / dstAspect;
      sy = (srcH - sh) / 2;
    }
    tempCtx.drawImage(photoEl, sx, sy, sw, sh, 0, 0, pw, ph);
    ctx.drawImage(tempCanvas, px, py);
  }

  // 3. Draw text
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

function drawLogo(ctx, S, showType) {
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
  ctx.fillText(`NOT AWARDS 2026`, S - S * LAYOUT.logo.right, ly + logoH + S * 0.008);
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
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aicp-not-a-judge-${state.firstName || 'export'}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

// --- MP4 Video Export (H.264 via mp4-muxer + VideoEncoder) ---

async function exportVideoMP4(bgCanvas, shaderRender, state, onProgress, onComplete) {
  const canvas = document.createElement('canvas');
  canvas.width = EXPORT_SIZE;
  canvas.height = EXPORT_SIZE;
  const ctx = canvas.getContext('2d');

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: {
      codec: 'avc',
      width: EXPORT_SIZE,
      height: EXPORT_SIZE,
    },
    fastStart: 'in-memory',
  });

  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => console.error('VideoEncoder error:', e),
  });

  encoder.configure({
    codec: 'avc1.640028',
    width: EXPORT_SIZE,
    height: EXPORT_SIZE,
    bitrate: 8_000_000,
    framerate: 30,
  });

  const totalFrames = 180; // 6 seconds at 30fps
  let shaderTime = performance.now() / 1000;

  for (let i = 0; i < totalFrames; i++) {
    shaderTime += 1 / 30;
    shaderRender(shaderTime);
    drawCard(ctx, bgCanvas, state);

    const frame = new VideoFrame(canvas, {
      timestamp: (i / 30) * 1_000_000,
    });
    encoder.encode(frame, { keyFrame: i % 30 === 0 });
    frame.close();

    if (onProgress) onProgress(i / totalFrames);

    // Yield to UI thread every few frames so progress bar updates
    if (i % 5 === 0) await new Promise(r => setTimeout(r, 0));
  }

  await encoder.flush();
  muxer.finalize();

  const blob = new Blob([target.buffer], { type: 'video/mp4' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aicp-not-a-judge-${state.firstName || 'export'}.mp4`;
  a.click();
  URL.revokeObjectURL(url);
  onComplete();
}

// --- WebM fallback (Firefox) ---

function exportVideoWebM(bgCanvas, shaderRender, state, onProgress, onComplete) {
  const canvas = document.createElement('canvas');
  canvas.width = EXPORT_SIZE;
  canvas.height = EXPORT_SIZE;
  const ctx = canvas.getContext('2d');

  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, {
    mimeType: 'video/webm;codecs=vp9',
    videoBitsPerSecond: 8000000,
  });

  const chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aicp-not-a-judge-${state.firstName || 'export'}.webm`;
    a.click();
    URL.revokeObjectURL(url);
    onComplete();
  };

  const duration = 6000;
  const startTime = performance.now();
  let shaderTime = performance.now() / 1000;

  recorder.start();

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
}

// --- Auto-detect: MP4 if supported, WebM fallback ---

export const supportsMP4 = typeof VideoEncoder !== 'undefined';

export async function exportVideo(bgCanvas, shaderRender, state, onProgress, onComplete) {
  if (supportsMP4) {
    await exportVideoMP4(bgCanvas, shaderRender, state, onProgress, onComplete);
  } else {
    exportVideoWebM(bgCanvas, shaderRender, state, onProgress, onComplete);
  }
}
