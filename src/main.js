import { initShader } from './shader.js';
import { exportPNG, exportVideo, videoSupport, videoFormatLabel } from './export.js';

// Funny category presets
const CATEGORIES = [
  'WATCHING FROM THE COUCH',
  'LINKEDIN SCROLLING',
  'PROFESSIONAL SPECTATOR',
  'BEING BITTER ABOUT IT',
  'ENTHUSIASTIC CLAPPING',
  'REFRESHING MY EMAIL',
  'ASKING MY AGENT ABOUT IT',
  'ARMCHAIR JUDGING',
  'COMMENTING "CONGRATS!"',
  'NOT EVEN MAD ABOUT IT',
];

// App state
const state = {
  firstName: '',
  lastName: '',
  category: 'WATCHING FROM THE COUCH',
  showType: 'POST AWARDS',
  prefix: 'ONCE AGAIN, NOT AN',
  title: 'AICP POST AWARDS JUDGE',
  hasPhoto: false,
  webcamActive: false,
};

let webcamStream = null;
let categoryIndex = 0;

// Elements
const bgCanvas = document.getElementById('bg-canvas');
const webcamVideo = document.getElementById('webcam');
const uploadedPhoto = document.getElementById('uploaded-photo');
const photoCanvas = document.getElementById('photo-canvas');
const photoPlaceholder = document.getElementById('photo-placeholder');
const firstNameInput = document.getElementById('first-name-input');
const lastNameInput = document.getElementById('last-name-input');
const categoryInput = document.getElementById('category-input');
const shuffleBtn = document.getElementById('shuffle-btn');
const webcamBtn = document.getElementById('webcam-btn');
const uploadBtn = document.getElementById('upload-btn');
const captureBtn = document.getElementById('capture-btn');
const retakeBtn = document.getElementById('retake-btn');
const fileInput = document.getElementById('file-input');
const exportPngBtn = document.getElementById('export-png');
const exportVideoBtn = document.getElementById('export-video');
const exportStatus = document.getElementById('export-status');
const progressFill = document.querySelector('.progress-fill');
const progressText = document.querySelector('.progress-text');

// Card overlay text elements
const prefixText = document.getElementById('prefix-text');
const titleText = document.getElementById('title-text');
const categoryText = document.getElementById('category-text');
const firstNameText = document.getElementById('first-name');
const lastNameText = document.getElementById('last-name');
const showTypeLabel = document.getElementById('show-type-label');
const toggleBtns = document.querySelectorAll('.toggle-btn');

// Initialize shader
const shader = initShader(bgCanvas);
if (!shader) {
  const msg = document.createElement('div');
  msg.style.cssText = 'padding:2rem;text-align:center;color:#888;';
  msg.textContent = 'WebGL is required but not supported in your browser.';
  document.body.replaceChildren(msg);
}

// Animation loop
let animationId;
function animate(timestamp) {
  const time = timestamp / 1000;
  shader.render(time);
  animationId = requestAnimationFrame(animate);
}
animationId = requestAnimationFrame(animate);

// --- Live Preview Updates ---

function updatePreview() {
  prefixText.textContent = state.prefix;
  titleText.textContent = state.title;
  categoryText.textContent = state.category;
  firstNameText.textContent = state.firstName || 'YOUR';
  lastNameText.textContent = state.lastName || 'NAME';
  showTypeLabel.textContent = state.showType;
}

firstNameInput.addEventListener('input', (e) => {
  state.firstName = e.target.value.toUpperCase();
  updatePreview();
});

lastNameInput.addEventListener('input', (e) => {
  state.lastName = e.target.value.toUpperCase();
  updatePreview();
});

categoryInput.addEventListener('input', (e) => {
  state.category = e.target.value.toUpperCase();
  updatePreview();
});

// Shuffle categories
shuffleBtn.addEventListener('click', () => {
  categoryIndex = (categoryIndex + 1) % CATEGORIES.length;
  const cat = CATEGORIES[categoryIndex];
  categoryInput.value = cat;
  state.category = cat;
  updatePreview();
});

// Show toggle
toggleBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    toggleBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.showType = btn.dataset.value;
    state.title = `AICP ${state.showType} JUDGE`;
    updatePreview();
  });
});

// --- Photo Handling ---

function showPhotoState(mode) {
  webcamVideo.style.display = 'none';
  uploadedPhoto.style.display = 'none';
  photoCanvas.style.display = 'none';
  photoPlaceholder.style.display = 'none';
  captureBtn.style.display = 'none';
  retakeBtn.style.display = 'none';

  if (mode === 'webcam') {
    webcamVideo.style.display = 'block';
    captureBtn.style.display = 'inline-flex';
    retakeBtn.style.display = 'none';
  } else if (mode === 'captured') {
    photoCanvas.style.display = 'block';
    retakeBtn.style.display = 'inline-flex';
    captureBtn.style.display = 'none';
  } else if (mode === 'uploaded') {
    uploadedPhoto.style.display = 'block';
    retakeBtn.style.display = 'inline-flex';
  } else {
    photoPlaceholder.style.display = 'flex';
  }
}

// Webcam
webcamBtn.addEventListener('click', async () => {
  if (state.webcamActive) {
    stopWebcam();
    return;
  }
  try {
    webcamStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 810 } },
    });
    webcamVideo.srcObject = webcamStream;
    state.webcamActive = true;
    state.hasPhoto = false;
    webcamBtn.textContent = 'Stop';
    showPhotoState('webcam');
  } catch (err) {
    console.error('Webcam error:', err);
    alert('Could not access webcam. Please check permissions.');
  }
});

function stopWebcam() {
  if (webcamStream) {
    webcamStream.getTracks().forEach((t) => t.stop());
    webcamStream = null;
  }
  webcamVideo.srcObject = null;
  state.webcamActive = false;
  webcamBtn.textContent = 'Webcam';
  if (!state.hasPhoto) showPhotoState('empty');
}

// Capture from webcam
captureBtn.addEventListener('click', () => {
  const pc = photoCanvas;
  const video = webcamVideo;
  pc.width = video.videoWidth;
  pc.height = video.videoHeight;
  const ctx = pc.getContext('2d');
  // Mirror the capture (webcam is mirrored)
  ctx.translate(pc.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  state.hasPhoto = true;
  stopWebcam();
  showPhotoState('captured');
});

// Upload
uploadBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    uploadedPhoto.src = ev.target.result;
    uploadedPhoto.onload = () => {
      state.hasPhoto = true;
      stopWebcam();
      showPhotoState('uploaded');
    };
  };
  reader.readAsDataURL(file);
  fileInput.value = '';
});

// Retake
retakeBtn.addEventListener('click', () => {
  state.hasPhoto = false;
  uploadedPhoto.src = '';
  showPhotoState('empty');
});

// Mirror webcam feed
webcamVideo.style.transform = 'scaleX(-1)';

// --- Export ---

exportPngBtn.addEventListener('click', () => {
  exportPNG(bgCanvas, state);
});

// Disable video button if browser can't export video at all
if (!videoSupport) {
  exportVideoBtn.disabled = true;
  exportVideoBtn.title = 'Video export not supported in this browser';
}

exportVideoBtn.addEventListener('click', async () => {
  exportVideoBtn.disabled = true;
  exportPngBtn.disabled = true;
  exportStatus.style.display = 'block';

  try {
    await exportVideo(
      bgCanvas,
      (time) => shader.render(time),
      state,
      (progress) => {
        progressFill.style.width = `${progress * 100}%`;
        const secs = Math.ceil(6 * (1 - progress));
        progressText.textContent = `Encoding ${videoFormatLabel}... ${secs}s remaining`;
      },
    );
  } catch (err) {
    console.error('Video export failed:', err);
    alert('Video export failed. Try downloading as PNG instead.');
  } finally {
    exportVideoBtn.disabled = !videoSupport;
    exportPngBtn.disabled = false;
    exportStatus.style.display = 'none';
    progressFill.style.width = '0%';
  }
});

// Initialize
showPhotoState('empty');
updatePreview();
