const songs = document.querySelectorAll('.song');
const audio = document.querySelector('#audio');
const visualizer = document.querySelector('#visualizer');
const waveContainer = document.querySelector('#wave');
const status = document.querySelector('#status');
const volume = document.querySelector('#volume');
const page = document.querySelector('.page');
const ray = document.querySelector('.ray');
const threeCanvas = document.querySelector('#three-bg');
const viewer = document.querySelector('#photo-viewer');
const viewerImage = document.querySelector('#viewer-image');
const viewerCaption = document.querySelector('#viewer-caption');
const starAccess = document.querySelector('#star-access');
const memoryGate = document.querySelector('#memory-gate');
const memoryForm = document.querySelector('#memory-form');
const memoryPassword = document.querySelector('#memory-password');
const gateError = document.querySelector('#gate-error');
const isDesktop = () => window.innerWidth >= 1024;
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const loadScript = (src) => new Promise((resolve, reject) => {
  const existing = document.querySelector(`script[src="${src}"]`);
  if (existing) {
    if (existing.dataset.loaded === 'true') {
      resolve();
      return;
    }
    existing.addEventListener('load', () => resolve(), { once: true });
    existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
    return;
  }

  const script = document.createElement('script');
  script.src = src;
  script.async = false;
  script.onload = () => {
    script.dataset.loaded = 'true';
    resolve();
  };
  script.onerror = () => reject(new Error(`Failed to load ${src}`));
  document.head.appendChild(script);
});
const ensureVisualLibraries = async () => {
  if (!isDesktop()) return;
  if (!window.THREE) await loadScript('js/three.min.js');
  if (!window.p5) await loadScript('js/p5.min.js');
};
const ensureArgon2 = async () => {
  if (window.hashwasm) return;
  await loadScript('tools/argon2id/argon2.umd.min.js');
};
let audioContext;
let analyser;
let source;
let data;
let currentSong;
let hoveredFrame;
let lastBounce = 0;
let lightFrame;
let waveformSketch;
let frequencyData;
let waveformData;
let threeRenderer;
let threeScene;
let threeCamera;
let threeLights;
let threeRenderLoop = null;
let desktopVisualsReady = false;

const SceneState = {
  lightPoint: { x: window.innerWidth * .85, y: window.innerHeight * .55 },
  lightAngle: 25,
  hoverLift: 0,
  hoverScale: 1,
  hoverRotate: 0,
  ambientPulse: 0,
  wavePalette: [255, 224, 149],
  currentMood: null,
};

audio.volume = Number(volume.value);

const timeMoods = [
  { start: 5, end: 11, name: 'pagi', icon: '☕', page: 'linear-gradient(105deg,#f8fcff 0%,#e6f5ff 34%,#b9dcf4 70%,#79abd0 100%)', beam: 'radial-gradient(circle,rgba(255,255,255,.98),rgba(190,231,255,.34) 42%,transparent 69%)', ray: 'linear-gradient(90deg,transparent 5%,rgba(255,255,255,.14) 30%,rgba(194,232,255,.42) 50%,transparent 77%)', wave: [196, 230, 255], threeAmbient: 0xe8f7ff, threeDirectional: 0xfff6d7, threeFill: 0xbfdfff },
  { start: 11, end: 16, name: 'siang', icon: '☀️', page: 'linear-gradient(105deg,#ffffff 0%,#f2faff 34%,#c9e9ff 70%,#73a8d3 100%)', beam: 'radial-gradient(circle,rgba(255,255,255,1),rgba(173,222,255,.38) 42%,transparent 69%)', ray: 'linear-gradient(90deg,transparent 5%,rgba(255,255,255,.18) 30%,rgba(181,229,255,.5) 50%,transparent 77%)', wave: [255, 241, 179], threeAmbient: 0xf8fbff, threeDirectional: 0xfff4ba, threeFill: 0xb7d8ff },
  { start: 16, end: 19, name: 'sore', icon: '🚦', page: 'linear-gradient(105deg,#d5a471 0%,#ebc083 34%,#aa6049 70%,#542e37 100%)', beam: 'radial-gradient(circle,rgba(255,248,196,.86),rgba(255,186,76,.25) 42%,transparent 69%)', ray: 'linear-gradient(90deg,transparent 5%,rgba(255,237,169,.07) 30%,rgba(255,224,143,.27) 50%,transparent 77%)', wave: [255, 207, 121], threeAmbient: 0xffe5b8, threeDirectional: 0xffc36c, threeFill: 0xf1a76a },
  { start: 19, end: 24, name: 'malam', icon: '🌙', page: 'linear-gradient(105deg,#111c35 0%,#273653 34%,#4b5668 70%,#1b2233 100%)', beam: 'radial-gradient(circle,rgba(220,235,255,.52),rgba(105,139,190,.18) 42%,transparent 69%)', ray: 'linear-gradient(90deg,transparent 5%,rgba(191,216,255,.05) 30%,rgba(166,202,255,.2) 50%,transparent 77%)', wave: [159, 201, 255], threeAmbient: 0xa7c8ff, threeDirectional: 0xb9d3ff, threeFill: 0x7ea9e8 },
  { start: 0, end: 5, name: 'malam', icon: '🛌', page: 'linear-gradient(105deg,#111c35 0%,#273653 34%,#4b5668 70%,#1b2233 100%)', beam: 'radial-gradient(circle,rgba(220,235,255,.52),rgba(105,139,190,.18) 42%,transparent 69%)', ray: 'linear-gradient(90deg,transparent 5%,rgba(191,216,255,.05) 30%,rgba(166,202,255,.2) 50%,transparent 77%)', wave: [159, 201, 255], threeAmbient: 0xa7c8ff, threeDirectional: 0xb9d3ff, threeFill: 0x7ea9e8 }
];

const updateTimeMood = () => {
  const now = new Date();
  const mood = timeMoods.find((item) => now.getHours() >= item.start && now.getHours() < item.end);
  const activeMood = mood || timeMoods[2];
  page.style.background = activeMood.page;
  document.querySelector('.sunbeam').style.background = activeMood.beam;
  ray.style.background = activeMood.ray;
  SceneState.wavePalette = activeMood.wave;
  SceneState.currentMood = activeMood;
  if (threeLights) {
    threeLights.ambient.color.setHex(activeMood.threeAmbient);
    threeLights.directional.color.setHex(activeMood.threeDirectional);
    threeLights.fill.color.setHex(activeMood.threeFill);
    threeLights.directional.intensity = 1.4 + (activeMood.start >= 19 || activeMood.start === 0 ? 0.9 : 0.35);
    threeLights.fill.intensity = 1.1 + (activeMood.start >= 19 || activeMood.start === 0 ? 1.1 : 0.2);
  }
  document.querySelector('#calendar-label').textContent = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now);
  document.querySelector('#time-label').textContent = activeMood.name + ', ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  document.querySelector('#time-icon').textContent = activeMood.icon;
};

const suspendVisuals = () => {
  if (threeRenderer && threeRenderLoop) {
    threeRenderer.setAnimationLoop(null);
  }
  if (waveformSketch && typeof waveformSketch.noLoop === 'function') {
    waveformSketch.noLoop();
  }
};

const resumeVisuals = () => {
  if (!isDesktop() || prefersReducedMotion || document.hidden) return;
  if (threeRenderer && threeRenderLoop) {
    threeRenderer.setAnimationLoop(threeRenderLoop);
  }
  if (waveformSketch && typeof waveformSketch.loop === 'function') {
    waveformSketch.loop();
  }
};

const startDesktopVisuals = () => {
  if (!isDesktop() || prefersReducedMotion) return;
  desktopVisualsReady = true;
  const runner = () => {
    ensureVisualLibraries().then(() => {
      if (window.THREE && !threeRenderer && threeCanvas) initThreeLighting();
      if (window.p5 && !waveformSketch && waveContainer) initWaveform();
      if (document.hidden) {
        suspendVisuals();
      } else {
        resumeVisuals();
      }
    }).catch(() => {
      // Keep the page functional even if the optional desktop visual layer fails to load.
    });
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(runner);
  } else {
    setTimeout(runner, 180);
  }
};

const handleVisibilityChange = () => {
  if (document.hidden) {
    suspendVisuals();
    return;
  }
  if (desktopVisualsReady) {
    resumeVisuals();
  }
};

const initThreeLighting = () => {
  if (!window.THREE || threeRenderer || !threeCanvas) return;

  threeRenderer = new THREE.WebGLRenderer({ canvas: threeCanvas, alpha: true, antialias: true });
  threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  threeRenderer.setSize(window.innerWidth, window.innerHeight);
  threeRenderer.setClearColor(0x000000, 0);

  threeScene = new THREE.Scene();
  threeCamera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100);
  threeCamera.position.set(0, 0, 12);

  threeLights = {
    ambient: new THREE.AmbientLight(0xfff4d6, 1.8),
    directional: new THREE.DirectionalLight(0xfff1b0, 1.9),
    fill: new THREE.PointLight(0x9ec9ff, 1.2, 40)
  };

  threeLights.directional.position.set(4, 4, 8);
  threeLights.fill.position.set(-5, -3, 7);
  threeScene.add(threeLights.ambient, threeLights.directional, threeLights.fill);

  const glowGroup = new THREE.Group();
  const glowMaterial = new THREE.MeshBasicMaterial({ color: 0xfff3bf, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false });
  const diskA = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), glowMaterial.clone());
  const diskB = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), glowMaterial.clone());
  diskA.position.set(-2, 1.2, -5);
  diskB.position.set(4, -1.5, -4);
  glowGroup.add(diskA, diskB);
  threeScene.add(glowGroup);

  const renderThree = () => {
    if (document.hidden || !desktopVisualsReady) return;
    const time = performance.now() * 0.001;
    const mood = SceneState.currentMood || timeMoods[2];
    const hourWave = Math.sin(time * 0.65 + (mood.start || 16) * 0.45);
    const pulse = audio && !audio.paused ? (Math.sin(time * 6) * 0.5 + 0.5) * 0.9 : 0.35;

    if (threeLights) {
      const directionalBase = 1.2 + (mood.start >= 19 || mood.start === 0 ? 1.15 : 0.4);
      const fillBase = 0.8 + (mood.start >= 19 || mood.start === 0 ? 1.2 : 0.25);

      threeLights.ambient.intensity = 1.3 + hourWave * 0.5 + pulse * 0.35;
      threeLights.directional.intensity = directionalBase + pulse * 1.25 + Math.sin(time * 0.9) * 0.25;
      threeLights.directional.position.x = Math.sin(time * 0.65) * 5.2;
      threeLights.directional.position.y = 3.8 + Math.sin(time * 0.9) * 1.6;
      threeLights.directional.position.z = 7 + Math.cos(time * 0.7) * 2.2;
      threeLights.fill.intensity = fillBase + pulse * 1.1;
      threeLights.fill.position.x = Math.cos(time * 0.9) * 4.8 - 1.5;
      threeLights.fill.position.y = Math.sin(time * 0.8) * 3.1;
    }

    if (glowGroup) {
      glowGroup.rotation.z = Math.sin(time * 0.4) * 0.22;
      glowGroup.position.y = Math.sin(time * 0.75) * 0.4;
      glowGroup.children.forEach((mesh, index) => {
        const opacity = 0.12 + pulse * 0.18 + index * 0.04;
        mesh.material.opacity = opacity;
      });
    }

    threeRenderer.render(threeScene, threeCamera);
  };

  threeRenderLoop = renderThree;
  if (!document.hidden) {
    threeRenderer.setAnimationLoop(renderThree);
  }
};

const resize = () => {
  if (waveformSketch && typeof waveformSketch.resizeCanvas === 'function') {
    waveformSketch.resizeCanvas(waveContainer.clientWidth, waveContainer.clientHeight);
  }
  if (threeRenderer && threeCamera) {
    const ratio = window.devicePixelRatio || 1;
    threeRenderer.setPixelRatio(Math.min(ratio, 2));
    threeRenderer.setSize(window.innerWidth, window.innerHeight);
    threeCamera.aspect = window.innerWidth / window.innerHeight;
    threeCamera.updateProjectionMatrix();
  }
};

const initWaveform = () => {
  if (!window.p5 || waveformSketch || !waveContainer) return;
  waveformSketch = new p5((p) => {
    p.setup = () => {
      p.pixelDensity(1);
      p.createCanvas(waveContainer.clientWidth, waveContainer.clientHeight);
      p.noFill();
      p.stroke(...SceneState.wavePalette, 230);
      p.strokeWeight(1.6);
      p.drawingContext.shadowBlur = 14;
      p.drawingContext.shadowColor = `rgba(${SceneState.wavePalette[0]}, ${SceneState.wavePalette[1]}, ${SceneState.wavePalette[2]}, 0.8)`;
    };

    p.draw = () => {
      if (!analyser || audio.paused) {
        p.clear();
        return;
      }

      if (!waveformData || waveformData.length === 0) return;

      analyser.getByteFrequencyData(frequencyData);
      analyser.getByteTimeDomainData(waveformData);

      const avgFrequency = frequencyData.reduce((sum, value) => sum + value, 0) / frequencyData.length;
      const amplitudeBoost = 0.6 + (avgFrequency / 255) * 1.8;
      const [r, g, b] = SceneState.wavePalette;

      p.clear();
      p.push();
      p.translate(0, p.height * 0.5);

      p.stroke(r, g, b, 235);
      p.strokeWeight(1.8);
      p.beginShape();
      for (let x = 0; x < p.width; x += 1) {
        const index = Math.floor((x / p.width) * waveformData.length);
        const sample = (waveformData[index] - 128) / 128;
        const y = sample * p.height * 0.35 * amplitudeBoost;
        p.curveVertex(x, y);
      }
      p.endShape();

      p.stroke(r, g, b, 100);
      p.strokeWeight(1);
      p.beginShape();
      for (let x = 0; x < p.width; x += 1) {
        const index = Math.floor((x / p.width) * frequencyData.length);
        const sample = frequencyData[index] / 255;
        const y = (sample - 0.5) * p.height * 0.72 * (0.7 + amplitudeBoost * 0.5);
        p.curveVertex(x, y);
      }
      p.endShape();

      p.stroke(r + 35, g + 35, b + 35, 150);
      p.strokeWeight(0.8);
      p.beginShape();
      for (let x = 0; x < p.width; x += 1) {
        const index = Math.floor((x / p.width) * waveformData.length);
        const sample = (waveformData[index] - 128) / 128;
        const y = sample * p.height * 0.18 * amplitudeBoost;
        p.curveVertex(x, y + 2);
      }
      p.endShape();
      p.pop();
    };

    p.windowResized = () => {
      if (waveContainer) {
        p.resizeCanvas(waveContainer.clientWidth, waveContainer.clientHeight);
      }
    };
  }, waveContainer);
};

const drawWave = () => {
  if (!waveformSketch || !analyser || audio.paused) return;
  waveformSketch.redraw();
};

const updateSongProgress = () => {
  if (!currentSong || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
  currentSong.querySelector('.song-progress').style.setProperty('--progress', (audio.currentTime / audio.duration * 100) + '%');
};

const bounce = () => {
  const now = performance.now();
  if (now - lastBounce < 220 || hoveredFrame) return;
  lastBounce = now;
  anime({ targets: '.polaroid, .music-sheet, .blue-strip, .page-fragment, .star-access', translateY: () => anime.random(-3, 3), duration: 180, easing: 'easeOutQuad' });
};

const setLightDirection = () => {
  const originX = page.clientWidth * .15;
  const originY = page.clientHeight * .06;
  const angle = Math.atan2(SceneState.lightPoint.y - originY, SceneState.lightPoint.x - originX) * 180 / Math.PI;
  SceneState.lightAngle = angle;
  ray.style.transform = 'rotate(' + angle + 'deg)';
  lightFrame = null;
};

const aimLightAt = (frame) => {
  const bounds = frame.getBoundingClientRect();
  SceneState.lightPoint = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
  if (!lightFrame) lightFrame = requestAnimationFrame(setLightDirection);
};

document.querySelectorAll('.polaroid').forEach((frame) => {
  frame.addEventListener('pointerenter', () => {
    hoveredFrame = frame;
    aimLightAt(frame);
    anime.remove(frame);
    document.querySelectorAll('.polaroid').forEach((item) => item.style.setProperty('z-index', '5', 'important'));
    frame.style.setProperty('z-index', '30', 'important');

    anime({
      targets: SceneState,
      hoverScale: 1.06,
      hoverLift: -14,
      hoverRotate: 0,
      duration: 360,
      easing: 'easeOutQuad',
      update: () => {
        frame.style.transform = `translateY(${SceneState.hoverLift}px) scale(${SceneState.hoverScale}) rotate(${SceneState.hoverRotate}deg)`;
      },
      complete: () => {
        frame.style.transform = 'translateY(-14px) scale(1.06) rotate(0deg)';
      }
    });
  });
  frame.addEventListener('pointerleave', () => {
    hoveredFrame = null;
    SceneState.lightPoint = { x: page.clientWidth * .85, y: page.clientHeight * .55 };
    if (!lightFrame) lightFrame = requestAnimationFrame(setLightDirection);
    frame.style.setProperty('z-index', '5', 'important');

    anime({
      targets: SceneState,
      hoverScale: 1,
      hoverLift: 0,
      hoverRotate: Number(frame.dataset.tilt),
      duration: 300,
      easing: 'easeOutQuad',
      update: () => {
        frame.style.transform = `translateY(${SceneState.hoverLift}px) scale(${SceneState.hoverScale}) rotate(${SceneState.hoverRotate}deg)`;
      },
      complete: () => {
        frame.style.transform = `translateY(0) scale(1) rotate(${Number(frame.dataset.tilt)}deg)`;
      }
    });
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
const closeMemoryGate = () => {
  memoryGate.classList.remove('open');
  memoryGate.setAttribute('aria-hidden', 'true');
  gateError.textContent = '';
  memoryForm.reset();
};
const deriveKey = async (password, saltB64) => {
  const salt = Uint8Array.from(atob(saltB64), (char) => char.charCodeAt(0));
  const keyBytes = await hashwasm.argon2id({
    password,
    salt,
    iterations: 3,
    memorySize: 65536,
    parallelism: 1,
    hashLength: 32,
    outputType: 'binary'
  });
  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    'AES-GCM',
    false,
    ['decrypt']
  );
};
starAccess.addEventListener('click', () => {
  memoryGate.classList.add('open');
  memoryGate.setAttribute('aria-hidden', 'false');
  memoryPassword.focus();
});
document.querySelector('#gate-close').addEventListener('click', closeMemoryGate);
memoryGate.addEventListener('click', (event) => { if (event.target === memoryGate) closeMemoryGate(); });
memoryForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  gateError.textContent = '';
  try {
    const response = await fetch('stratterium/stratterium.enc.json');
    if (!response.ok) throw new Error('encrypted payload unavailable');
    const { salt, iv, ciphertext } = await response.json();
    await ensureArgon2();
    const key = await deriveKey(memoryPassword.value, salt);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: Uint8Array.from(atob(iv), (char) => char.charCodeAt(0)) },
      key,
      Uint8Array.from(atob(ciphertext), (char) => char.charCodeAt(0))
    );
    sessionStorage.setItem('stratterium_payload', new TextDecoder().decode(decrypted));
    window.location.href = 'stratterium/stratterium-secret.html';
  } catch (error) {
    gateError.textContent = 'Kata sandi itu belum membuka kenangan ini.';
    memoryPassword.select();
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  closeViewer();
  if (memoryGate.classList.contains('open')) closeMemoryGate();
});

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
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.82;
      source.connect(analyser);
      analyser.connect(audioContext.destination);
      data = new Uint8Array(analyser.fftSize);
      frequencyData = new Uint8Array(analyser.frequencyBinCount);
      waveformData = new Uint8Array(analyser.fftSize);
      initWaveform();
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
document.addEventListener('visibilitychange', handleVisibilityChange);
startDesktopVisuals();
resize();
window.addEventListener('resize', resize);

const sceneAnimationTimeline = anime.timeline({ easing: 'easeOutExpo' });
sceneAnimationTimeline
  .add({
    targets: '.sunbeam',
    translateX: ['-5%', '18%'],
    translateY: ['-3%', '18%'],
    scale: [.9, 1.12],
    direction: 'alternate',
    loop: true,
    duration: 8500,
    easing: 'easeInOutSine'
  })
  .add({
    targets: '.ray',
    opacity: [.35, .8],
    direction: 'alternate',
    loop: true,
    duration: 6200,
    easing: 'easeInOutSine'
  }, 0)
  .add({
    targets: '.music-sheet, .blue-strip, .page-fragment, .lace, .star-access',
    opacity: [0, 1],
    translateY: [20, 0],
    delay: anime.stagger(80),
    duration: 1100
  }, 0);
