const songs = document.querySelectorAll('.song');
const audio = document.querySelector('#audio');
const visualizer = document.querySelector('#visualizer');
const canvas = document.querySelector('#wave');
const context = canvas.getContext('2d');
const status = document.querySelector('#status');
const volume = document.querySelector('#volume');
const page = document.querySelector('.page');
const ray = document.querySelector('.ray');
const viewer = document.querySelector('#photo-viewer');
const viewerImage = document.querySelector('#viewer-image');
const viewerCaption = document.querySelector('#viewer-caption');
let audioContext;
let analyser;
let source;
let data;
let currentSong;
let hoveredFrame;
let lastBounce = 0;
let lightFrame;
let lightPoint = { x: window.innerWidth * .85, y: window.innerHeight * .55 };

audio.volume = Number(volume.value);

const timeMoods = [
  { start: 5, end: 11, name: 'pagi', icon: '☕', page: 'linear-gradient(105deg,#f8fcff 0%,#e6f5ff 34%,#b9dcf4 70%,#79abd0 100%)', beam: 'radial-gradient(circle,rgba(255,255,255,.98),rgba(190,231,255,.34) 42%,transparent 69%)', ray: 'linear-gradient(90deg,transparent 5%,rgba(255,255,255,.14) 30%,rgba(194,232,255,.42) 50%,transparent 77%)' },
  { start: 11, end: 16, name: 'siang', icon: '☀️', page: 'linear-gradient(105deg,#ffffff 0%,#f2faff 34%,#c9e9ff 70%,#73a8d3 100%)', beam: 'radial-gradient(circle,rgba(255,255,255,1),rgba(173,222,255,.38) 42%,transparent 69%)', ray: 'linear-gradient(90deg,transparent 5%,rgba(255,255,255,.18) 30%,rgba(181,229,255,.5) 50%,transparent 77%)' },
  { start: 16, end: 19, name: 'sore', icon: '🚦', page: 'linear-gradient(105deg,#d5a471 0%,#ebc083 34%,#aa6049 70%,#542e37 100%)', beam: 'radial-gradient(circle,rgba(255,248,196,.86),rgba(255,186,76,.25) 42%,transparent 69%)', ray: 'linear-gradient(90deg,transparent 5%,rgba(255,237,169,.07) 30%,rgba(255,224,143,.27) 50%,transparent 77%)' },
  { start: 19, end: 24, name: 'malam', icon: '🌙', page: 'linear-gradient(105deg,#111c35 0%,#273653 34%,#4b5668 70%,#1b2233 100%)', beam: 'radial-gradient(circle,rgba(220,235,255,.52),rgba(105,139,190,.18) 42%,transparent 69%)', ray: 'linear-gradient(90deg,transparent 5%,rgba(191,216,255,.05) 30%,rgba(166,202,255,.2) 50%,transparent 77%)' },
  { start: 0, end: 5, name: 'malam', icon: '🛌', page: 'linear-gradient(105deg,#111c35 0%,#273653 34%,#4b5668 70%,#1b2233 100%)', beam: 'radial-gradient(circle,rgba(220,235,255,.52),rgba(105,139,190,.18) 42%,transparent 69%)', ray: 'linear-gradient(90deg,transparent 5%,rgba(191,216,255,.05) 30%,rgba(166,202,255,.2) 50%,transparent 77%)' }
];

const updateTimeMood = () => {
  const now = new Date();
  const mood = timeMoods.find((item) => now.getHours() >= item.start && now.getHours() < item.end);
  page.style.background = mood.page;
  document.querySelector('.sunbeam').style.background = mood.beam;
  ray.style.background = mood.ray;
  document.querySelector('#calendar-label').textContent = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now);
  document.querySelector('#time-label').textContent = mood.name + ', ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  document.querySelector('#time-icon').textContent = mood.icon;
};

const resize = () => {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * ratio;
  canvas.height = canvas.clientHeight * ratio;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
};

let waveRunning = false;
const drawWave = () => {
  if (waveRunning || !analyser || audio.paused) return;
  waveRunning = true;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  context.clearRect(0, 0, width, height);
  context.beginPath();
  context.lineWidth = 1.5;
  context.strokeStyle = 'rgba(255,224,149,.9)';
  analyser.getByteTimeDomainData(data);
  for (let x = 0; x < width; x += 1) {
    const input = (data[Math.floor(x / width * data.length)] - 128) / 128;
    const y = height / 2 + input * height * .9;
    x ? context.lineTo(x, y) : context.moveTo(x, y);
  }
  context.stroke();
  waveRunning = false;
  if (!audio.paused) requestAnimationFrame(drawWave);
};

const updateSongProgress = () => {
  if (!currentSong || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
  currentSong.querySelector('.song-progress').style.setProperty('--progress', (audio.currentTime / audio.duration * 100) + '%');
};

const bounce = () => {
  const now = performance.now();
  if (now - lastBounce < 220 || hoveredFrame) return;
  lastBounce = now;
  anime({ targets: '.polaroid, .music-sheet, .blue-strip, .page-fragment', translateY: () => anime.random(-3, 3), duration: 180, easing: 'easeOutQuad' });
};

const setLightDirection = () => {
  const originX = page.clientWidth * .15;
  const originY = page.clientHeight * .06;
  const angle = Math.atan2(lightPoint.y - originY, lightPoint.x - originX) * 180 / Math.PI;
  ray.style.transform = 'rotate(' + angle + 'deg)';
  lightFrame = null;
};

const aimLightAt = (frame) => {
  const bounds = frame.getBoundingClientRect();
  lightPoint = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
  if (!lightFrame) lightFrame = requestAnimationFrame(setLightDirection);
};

document.querySelectorAll('.polaroid').forEach((frame) => {
  frame.addEventListener('pointerenter', () => {
    hoveredFrame = frame;
    aimLightAt(frame);
    anime.remove(frame);
    document.querySelectorAll('.polaroid').forEach((item) => item.style.setProperty('z-index', '5', 'important'));
    frame.style.setProperty('z-index', '30', 'important');
    anime({ targets: frame, scale: 1.06, translateY: -14, rotate: 0, duration: 360, easing: 'easeOutQuad' });
  });
  frame.addEventListener('pointerleave', () => {
    hoveredFrame = null;
    lightPoint = { x: page.clientWidth * .85, y: page.clientHeight * .55 };
    if (!lightFrame) lightFrame = requestAnimationFrame(setLightDirection);
    frame.style.setProperty('z-index', '5', 'important');
    anime({ targets: frame, scale: 1, translateY: 0, rotate: Number(frame.dataset.tilt), duration: 300, easing: 'easeOutQuad' });
  });
  frame.querySelector('img').addEventListener('click', () => {
    viewerImage.src = frame.querySelector('img').src;
    viewerImage.alt = frame.querySelector('img').alt;
    viewerCaption.textContent = frame.querySelector('img').alt;
    viewer.classList.add('open');
  });
});

const closeViewer = () => viewer.classList.remove('open');
document.querySelector('#viewer-close').addEventListener('click', closeViewer);
viewer.addEventListener('click', (event) => { if (event.target === viewer) closeViewer(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeViewer(); });

songs.forEach((song) => song.addEventListener('click', async () => {
  if (currentSong === song && !audio.paused) {
    audio.pause();
    song.classList.remove('active');
    visualizer.classList.remove('playing');
    status.textContent = 'dijeda';
    return;
  }
  songs.forEach((item) => item.classList.remove('active'));
  songs.forEach((item) => item.querySelector('.song-progress').style.setProperty('--progress', '0%'));
  currentSong = song;
  song.classList.add('active');
  audio.pause();
  audio.src = song.dataset.src;
  audio.load();
  status.textContent = song.dataset.title + ' — ' + song.dataset.artist;
  visualizer.classList.add('playing');
  try {
    if (!audioContext) {
      audioContext = new AudioContext();
      source = audioContext.createMediaElementSource(audio);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyser.connect(audioContext.destination);
      data = new Uint8Array(analyser.frequencyBinCount);
    }
    await audioContext.resume();
    if (audio.readyState < 3) await new Promise((resolve, reject) => { audio.addEventListener('canplay', resolve, { once: true }); audio.addEventListener('error', reject, { once: true }); });
    await audio.play();
    drawWave();
  } catch (error) {
    if (currentSong === song) { visualizer.classList.remove('playing'); status.textContent = 'audio tidak dapat dimuat'; }
  }
}));

volume.addEventListener('input', () => { audio.volume = Number(volume.value); });
audio.addEventListener('loadedmetadata', updateSongProgress);
audio.addEventListener('timeupdate', () => { updateSongProgress(); if (!audio.paused) bounce(); });
audio.addEventListener('ended', () => { songs.forEach((item) => item.classList.remove('active')); if (currentSong) currentSong.querySelector('.song-progress').style.setProperty('--progress', '100%'); visualizer.classList.remove('playing'); status.textContent = 'pilih nada untuk memulai'; });

updateTimeMood();
setInterval(updateTimeMood, 60000);
resize();
window.addEventListener('resize', resize);
anime({ targets: '.sunbeam', translateX: ['-5%', '18%'], translateY: ['-3%', '18%'], scale: [.9, 1.12], direction: 'alternate', loop: true, duration: 8500, easing: 'easeInOutSine' });
anime({ targets: '.ray', opacity: [.35, .8], direction: 'alternate', loop: true, duration: 6200, easing: 'easeInOutSine' });
anime({ targets: '.music-sheet, .blue-strip, .page-fragment, .lace', opacity: [0, 1], translateY: [20, 0], delay: anime.stagger(80), duration: 1100, easing: 'easeOutExpo' });