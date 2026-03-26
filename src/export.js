// Export functions: composite card to canvas, export as PNG or MP4 video
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import HME from 'h264-mp4-encoder';

const EXPORT_SIZE = 1080;

// Mobile: lighter settings to avoid overwhelming phone GPUs
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const VIDEO_CONFIG = isMobile
  ? { size: 720, fps: 15, duration: 4000 }
  : { size: 1080, fps: 30, duration: 6000 };

const LAYOUT = {
  padding: 0.06,
  photo: { top: 0.06, width: 0.62, aspectRatio: 4 / 3.2 },
  setup: { top: 0.575, size: 0.030, weight: '400' },
  prefix: { top: 0.605, size: 0.058, weight: '400' },
  title: { top: 0.66, size: 0.058, weight: '400' },
  category: { top: 0.725, size: 0.026, weight: '400', letterSpacing: 4 },
  name: { top: 0.80, size: 0.055, weight: '400', lineHeight: 1.05 },
  logo: { bottom: 0.05, right: 0.06, width: 0.18 },
  logoText: { size: 0.016 },
};

// Pre-load the real AICP logo SVG
let logoImage = null;
const logoImg = new Image();
logoImg.onload = () => { logoImage = logoImg; };
logoImg.src = '/aicp-logo.svg';

// --- Video support detection ---

// Tier 1: Native VideoEncoder (Chrome/Edge desktop)
// Tier 2: WASM H.264 encoder (everything else — iOS, Safari, Firefox, Android)
// iOS exposes VideoEncoder but it doesn't actually work (produces null metadata)
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const hasNativeEncoder = !isIOS && typeof VideoEncoder !== 'undefined';
export const videoSupport = 'mp4'; // Always supported now via WASM fallback
export const videoFormatLabel = 'MP4';

// --- iOS-safe download ---

function downloadBlob(blob, filename) {
  const file = new File([blob], filename, { type: blob.type });

  if (navigator.share && navigator.canShare) {
    try {
      if (navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file] }).catch(() => {
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

function drawCard(ctx, bgCanvas, state, S) {
  if (!S) S = EXPORT_SIZE;
  const pad = S * LAYOUT.padding;
  const lsScale = S / EXPORT_SIZE;

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

  ctx.font = `${LAYOUT.setup.weight} ${S * LAYOUT.setup.size}px Bebas Neue`;
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = 'white';
  ctx.fillText('ONCE AGAIN,', pad, S * LAYOUT.setup.top);
  ctx.globalAlpha = 1.0;

  ctx.font = `${LAYOUT.prefix.weight} ${S * LAYOUT.prefix.size}px Bebas Neue`;
  ctx.fillStyle = '#cc3333';
  ctx.fillText('NOT', pad, S * LAYOUT.prefix.top);
  const notWidth = ctx.measureText('NOT').width;
  ctx.fillStyle = 'white';
  ctx.fillText('-A-JUDGE', pad + notWidth, S * LAYOUT.prefix.top);

  ctx.font = `${LAYOUT.title.weight} ${S * LAYOUT.title.size}px Bebas Neue`;
  ctx.fillStyle = 'white';
  ctx.fillText('AICP ' + state.showType, pad, S * LAYOUT.title.top);

  ctx.font = `${LAYOUT.category.weight} ${S * LAYOUT.category.size}px Fira Mono`;
  ctx.globalAlpha = 0.7;
  const categoryText = state.category.toUpperCase();
  let cx = pad;
  for (let i = 0; i < categoryText.length; i++) {
    ctx.fillText(categoryText[i], cx, S * LAYOUT.category.top);
    cx += ctx.measureText(categoryText[i]).width + LAYOUT.category.letterSpacing * lsScale;
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
  drawCard(ctx, bgCanvas, state, EXPORT_SIZE);

  canvas.toBlob((blob) => {
    downloadBlob(blob, `aicp-not-a-judge-${state.firstName || 'export'}.png`);
  }, 'image/png');
}

// --- Tier 1: Native VideoEncoder + mp4-muxer (Chrome/Edge) ---

async function exportVideoNative(bgCanvas, shaderRender, state, onProgress) {
  const S = VIDEO_CONFIG.size;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width: S, height: S },
    fastStart: 'in-memory',
  });

  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { throw new Error('VideoEncoder error: ' + e.message); },
  });

  encoder.configure({
    codec: 'avc1.640028',
    width: S,
    height: S,
    bitrate: 8_000_000,
    framerate: VIDEO_CONFIG.fps,
  });

  const totalFrames = Math.round(VIDEO_CONFIG.duration / 1000 * VIDEO_CONFIG.fps);
  let shaderTime = performance.now() / 1000;

  for (let i = 0; i < totalFrames; i++) {
    shaderTime += 1 / VIDEO_CONFIG.fps;
    shaderRender(shaderTime);
    drawCard(ctx, bgCanvas, state, S);

    const frame = new VideoFrame(canvas, { timestamp: (i / VIDEO_CONFIG.fps) * 1_000_000 });
    encoder.encode(frame, { keyFrame: i % VIDEO_CONFIG.fps === 0 });
    frame.close();

    if (onProgress) onProgress(i / totalFrames);
    if (i % 5 === 0) await new Promise(r => setTimeout(r, 0));
  }

  await encoder.flush();
  muxer.finalize();

  const blob = new Blob([target.buffer], { type: 'video/mp4' });
  downloadBlob(blob, `aicp-not-a-judge-${state.firstName || 'export'}.mp4`);
}

// --- Tier 2: WASM H.264 encoder (iOS, Safari, Firefox, Android — everything) ---

async function exportVideoWASM(bgCanvas, shaderRender, state, onProgress) {
  const S = VIDEO_CONFIG.size;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');

  // Initialize WASM encoder
  const encoder = await HME.createH264MP4Encoder();
  encoder.width = S;
  encoder.height = S;
  encoder.frameRate = VIDEO_CONFIG.fps;
  encoder.quantizationParameter = 18; // Quality: lower = better (10-51 range)
  encoder.initialize();

  const totalFrames = Math.round(VIDEO_CONFIG.duration / 1000 * VIDEO_CONFIG.fps);
  let shaderTime = performance.now() / 1000;

  for (let i = 0; i < totalFrames; i++) {
    shaderTime += 1 / VIDEO_CONFIG.fps;
    shaderRender(shaderTime);
    drawCard(ctx, bgCanvas, state, S);

    // Get RGBA pixels from canvas and feed to encoder
    const imageData = ctx.getImageData(0, 0, S, S);
    encoder.addFrameRgba(imageData.data);

    if (onProgress) onProgress(i / totalFrames);

    // Yield to UI thread so progress bar updates
    if (i % 3 === 0) await new Promise(r => setTimeout(r, 0));
  }

  encoder.finalize();

  const buffer = encoder.FS.readFile(encoder.outputFilename);
  encoder.delete();

  const blob = new Blob([buffer], { type: 'video/mp4' });
  downloadBlob(blob, `aicp-not-a-judge-${state.firstName || 'export'}.mp4`);
}

// --- Main export dispatcher ---

export async function exportVideo(bgCanvas, shaderRender, state, onProgress) {
  if (hasNativeEncoder) {
    await exportVideoNative(bgCanvas, shaderRender, state, onProgress);
  } else {
    await exportVideoWASM(bgCanvas, shaderRender, state, onProgress);
  }
}
