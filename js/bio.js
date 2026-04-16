/* ============================================================
   DON LOW — Bio page
   Three.js 3D mask + scroll-controlled rotation + word reveal
   ============================================================ */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ---------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------
const frame        = document.getElementById('frame');
const canvasWrap   = document.getElementById('bio-canvas-wrap');
const bioLoader    = document.getElementById('bio-loader');
const paragraph    = document.getElementById('bio-paragraph');
const words        = paragraph ? paragraph.querySelectorAll('.bio-word') : [];

// ---------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------
const MODEL_URL       = '/assets/bio/mask.glb';
const INITIAL_TILT    = -Math.PI * 0.55;  // start: model looking DOWN (we see top of cap)
const FINAL_TILT      = 0;                // end: facing camera
const AUTO_DURATION   = 2200;             // ms of auto-rotation at start (covers ~50% of the way)
const AUTO_PROGRESS   = 0.5;              // how far auto-rotation goes (0→1)

// ---------------------------------------------------------------
// THREE.JS SETUP
// ---------------------------------------------------------------
const scene    = new THREE.Scene();
scene.background = null;

const w = canvasWrap.clientWidth;
const h = canvasWrap.clientHeight;

const camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 100);
camera.position.set(0, 0, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(w, h);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
canvasWrap.appendChild(renderer.domElement);

// Lights — dramatic, golden tone
const ambient = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xffeac2, 1.8);
keyLight.position.set(2, 3, 4);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xffd580, 0.7);
fillLight.position.set(-3, 1, 2);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xa83030, 0.5);
rimLight.position.set(0, -2, -3);
scene.add(rimLight);

// ---------------------------------------------------------------
// LOAD MODEL
// ---------------------------------------------------------------
let model = null;
let modelLoaded = false;
let autoStart = null;   // timestamp when auto-rotation begins
let scrollProgress = 0; // 0 → 1 based on scroll position

const loader = new GLTFLoader();
loader.load(
  MODEL_URL,
  (gltf) => {
    model = gltf.scene;

    // Auto-fit the model — compute bounding box, center, scale
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    // Center the model
    model.position.sub(center);

    // Scale to fit nicely
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 2.2 / maxDim;
    model.scale.setScalar(scale);

    // Initial rotation (looking down / cap on top)
    model.rotation.x = INITIAL_TILT;

    scene.add(model);
    modelLoaded = true;
    autoStart = performance.now();

    // Hide loader
    if (bioLoader) bioLoader.classList.add('bio-stage__loader--hidden');
  },
  (xhr) => {
    // Progress
    if (bioLoader && xhr.total) {
      const pct = Math.round((xhr.loaded / xhr.total) * 100);
      const span = bioLoader.querySelector('span');
      if (span) span.textContent = 'LOADING ' + pct + '%';
    }
  },
  (err) => {
    console.error('GLB load failed', err);
    if (bioLoader) {
      const span = bioLoader.querySelector('span');
      if (span) span.textContent = 'LOAD ERROR';
    }
  }
);

// ---------------------------------------------------------------
// SCROLL TRACKING (inside .frame--scroll)
// ---------------------------------------------------------------
function updateScrollProgress() {
  if (!frame) return;
  const maxScroll = frame.scrollHeight - frame.clientHeight;
  if (maxScroll <= 0) {
    scrollProgress = 0;
    return;
  }
  scrollProgress = Math.min(1, Math.max(0, frame.scrollTop / maxScroll));
}

frame.addEventListener('scroll', updateScrollProgress, { passive: true });

// ---------------------------------------------------------------
// RESIZE
// ---------------------------------------------------------------
function onResize() {
  const w = canvasWrap.clientWidth;
  const h = canvasWrap.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', onResize);

// ---------------------------------------------------------------
// WORD REVEAL
// ---------------------------------------------------------------
function updateWordReveal() {
  if (!words.length) return;

  // Start revealing once we're past the auto-rotation phase (scroll > 10%)
  // and complete by the time scroll reaches 95%
  const startAt = 0.12;
  const endAt   = 0.95;
  const range   = endAt - startAt;

  let local = (scrollProgress - startAt) / range;
  local = Math.min(1, Math.max(0, local));

  const toShow = Math.floor(local * words.length);
  for (let i = 0; i < words.length; i++) {
    if (i < toShow) {
      if (!words[i].classList.contains('bio-word--visible'))
        words[i].classList.add('bio-word--visible');
    } else {
      if (words[i].classList.contains('bio-word--visible'))
        words[i].classList.remove('bio-word--visible');
    }
  }
}

// ---------------------------------------------------------------
// ANIMATION LOOP
// ---------------------------------------------------------------
function ease(t) {
  // easeOutCubic
  return 1 - Math.pow(1 - t, 3);
}

function animate(now) {
  requestAnimationFrame(animate);

  if (model && modelLoaded) {
    // Phase 1: auto-rotation from INITIAL_TILT toward AUTO_PROGRESS
    let autoT = 0;
    if (autoStart !== null) {
      autoT = Math.min(1, (now - autoStart) / AUTO_DURATION);
      autoT = ease(autoT);
    }
    const autoProgress = autoT * AUTO_PROGRESS; // 0 → 0.5

    // Phase 2: scroll from autoProgress to 1.0
    // Scroll is 0→1; but we only want scroll to PUSH forward past the auto progress
    const scrollContrib = scrollProgress * (1 - AUTO_PROGRESS);
    const totalProgress = Math.min(1, autoProgress + scrollContrib);

    // Interpolate rotation
    model.rotation.x = INITIAL_TILT + (FINAL_TILT - INITIAL_TILT) * totalProgress;

    // Very subtle idle Y-rotation for life (smaller once fully visible)
    const idleSwing = Math.sin(now * 0.0006) * 0.08;
    model.rotation.y = idleSwing * totalProgress;
  }

  // Word reveal
  updateWordReveal();

  renderer.render(scene, camera);
}

requestAnimationFrame(animate);

// Initial scroll state
updateScrollProgress();
