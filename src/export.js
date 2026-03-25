// Export functions: composite card to canvas, export as PNG or WebM video

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
  category: { top: 0.72, size: 0.026, weight: '400', letterSpacing: 3 },
  name: { top: 0.80, size: 0.055, weight: '700', lineHeight: 1.05 },
  logo: { bottom: 0.05, right: 0.06, width: 0.18 },
  logoText: { size: 0.016 },
};

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

    // Draw with grayscale — we composite via temp canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = pw;
    tempCanvas.height = ph;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.filter = 'grayscale(1)';

    // Cover-fit the photo
    const srcAspect = (photoEl.videoWidth || photoEl.naturalWidth || photoEl.width) /
                      (photoEl.videoHeight || photoEl.naturalHeight || photoEl.height);
    const dstAspect = pw / ph;
    let sx = 0, sy = 0, sw, sh;
    const srcW = photoEl.videoWidth || photoEl.naturalWidth || photoEl.width;
    const srcH = photoEl.videoHeight || photoEl.naturalHeight || photoEl.height;
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

  // Prefix: "ONCE AGAIN, NOT AN"
  ctx.font = `${LAYOUT.prefix.weight} ${S * LAYOUT.prefix.size}px Oswald`;
  ctx.globalAlpha = 0.9;
  ctx.fillText(state.prefix, pad, S * LAYOUT.prefix.top);
  ctx.globalAlpha = 1.0;

  // Title: "AICP POST AWARDS JUDGE"
  ctx.font = `${LAYOUT.title.weight} ${S * LAYOUT.title.size}px Oswald`;
  ctx.fillText(state.title, pad, S * LAYOUT.title.top);

  // Category
  ctx.font = `${LAYOUT.category.weight} ${S * LAYOUT.category.size}px Oswald`;
  ctx.globalAlpha = 0.75;
  const categoryText = state.category.toUpperCase();
  // Manual letter spacing
  let cx = pad;
  for (let i = 0; i < categoryText.length; i++) {
    ctx.fillText(categoryText[i], cx, S * LAYOUT.category.top);
    cx += ctx.measureText(categoryText[i]).width + LAYOUT.category.letterSpacing;
  }
  ctx.globalAlpha = 1.0;

  // Name
  ctx.font = `${LAYOUT.name.weight} ${S * LAYOUT.name.size}px Oswald`;
  const nameY = S * LAYOUT.name.top;
  ctx.fillText(state.firstName.toUpperCase(), pad, nameY);
  ctx.fillText(state.lastName.toUpperCase(), pad, nameY + S * LAYOUT.name.size * LAYOUT.name.lineHeight);

  // 4. Draw AICP logo
  drawLogo(ctx, S, state.showType);
}

function drawLogo(ctx, S, showType) {
  const logoW = S * LAYOUT.logo.width;
  const logoH = logoW * 0.45;
  const lx = S - S * LAYOUT.logo.right - logoW;
  const ly = S - S * LAYOUT.logo.bottom - logoH;
  const scale = logoW / 200;

  ctx.save();
  ctx.translate(lx, ly);
  ctx.scale(scale, scale);

  ctx.fillStyle = 'white';

  // A — triangle
  ctx.beginPath();
  ctx.moveTo(0, 60);
  ctx.lineTo(22, 4);
  ctx.lineTo(44, 60);
  ctx.lineTo(34, 60);
  ctx.lineTo(22, 20);
  ctx.lineTo(10, 60);
  ctx.closePath();
  ctx.fill();

  // I — circle
  ctx.beginPath();
  ctx.arc(64, 38, 18, 0, Math.PI * 2);
  ctx.fill();

  // C — open arc
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(100, 38, 24, -0.9, 0.9, true);
  ctx.stroke();

  // P — vertical bar + bowl
  ctx.fillRect(140, 4, 12, 56);
  ctx.beginPath();
  ctx.arc(158, 22, 18, -Math.PI / 2, Math.PI / 2);
  ctx.lineWidth = 10;
  ctx.stroke();

  ctx.restore();

  // Logo subtext
  ctx.font = `500 ${S * LAYOUT.logoText.size}px Oswald`;
  ctx.fillStyle = 'white';
  ctx.textAlign = 'right';
  ctx.fillText(`NOT AWARDS 2026`, S - S * LAYOUT.logo.right, ly + logoH + S * 0.015);
  ctx.textAlign = 'left';
}

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

export function exportVideo(bgCanvas, shaderRender, state, onProgress, onComplete) {
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

  const duration = 6000; // 6 seconds
  const startTime = performance.now();
  let shaderTime = performance.now() / 1000;

  recorder.start();

  function renderLoop() {
    const elapsed = performance.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    if (onProgress) onProgress(progress);

    // Advance shader time
    shaderTime += 1 / 30;
    shaderRender(shaderTime);

    // Composite
    drawCard(ctx, bgCanvas, state);

    if (elapsed < duration) {
      requestAnimationFrame(renderLoop);
    } else {
      recorder.stop();
    }
  }

  renderLoop();
}
