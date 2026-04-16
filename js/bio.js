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
// Start: head tilted DOWN (top of cap visible from above)
// End: face camera
const INITIAL_TILT    = Math.PI * 0.55;   // +110° around X: top-of-head toward camera
const FINAL_TILT      = 0;
const AUTO_DURATION   = 2200;
const AUTO_PROGRESS   = 0.5;

// ---------------------------------------------------------------
// THREE.JS SETUP
// ---------------------------------------------------------------
const scene = new THREE.Scene();
scene.background = null;

const w0 = canvasWrap.clientWidth  || 400;
const h0 = canvasWrap.clientHeight || 600;

// Narrower FOV + closer camera = bigger model in view
const camera = new THREE.PerspectiveCamera(30, w0 / h0, 0.1, 100);
camera.position.set(0, 0, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(w0, h0);
// Bright, punchy — no cinematic crushing
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
canvasWrap.appendChild(renderer.domElement);

// --- Lights: bright, warm, clean --------------------------------
const ambient = new THREE.AmbientLight(0xffffff, 1.3);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
keyLight.position.set(2, 3, 4);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xffeed0, 1.2);
fillLight.position.set(-3, 1, 2);
scene.add(fillLight);

const topLight = new THREE.DirectionalLight(0xffffff, 1.0);
topLight.position.set(0, 5, 2);
scene.add(topLight);

// ---------------------------------------------------------------
// LOAD MODEL
// ---------------------------------------------------------------
let model = null;
let modelLoaded = false;
let autoStart = null;
let scrollProgress = 0;

const loader = new GLTFLoader();
loader.load(
  MODEL_URL,
  (gltf) => {
    model = gltf.scene;

    // Auto-fit
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    // Center
    model.position.sub(center);

    // Scale — middle ground, commanding but not cropped
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 2.7 / maxDim;
    model.scale.setScalar(scale);

    // Shift up so the model is centered in the VISIBLE area
    // (top 55% of the stage — text overlay covers the bottom 45%)
    model.position.y += 0.55;

    // Initial rotation: head-down (see top of cap)
    model.rotation.x = INITIAL_TILT;

    scene.add(model);
    modelLoaded = true;
    autoStart = performance.now();

    if (bioLoader) bioLoader.classList.add('bio-stage__loader--hidden');
  },
  (xhr) => {
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
  if (w === 0 || h === 0) return;
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

  // Reveal words between 15% and 98% scroll progress
  const startAt = 0.15;
  const endAt   = 0.98;
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
  return 1 - Math.pow(1 - t, 3);
}

function animate(now) {
  requestAnimationFrame(animate);

  if (model && modelLoaded) {
    // Phase 1: auto-rotation (0 → AUTO_PROGRESS)
    let autoT = 0;
    if (autoStart !== null) {
      autoT = Math.min(1, (now - autoStart) / AUTO_DURATION);
      autoT = ease(autoT);
    }
    const autoProgress = autoT * AUTO_PROGRESS;

    // Phase 2: scroll continues (AUTO_PROGRESS → 1.0)
    const scrollContrib = scrollProgress * (1 - AUTO_PROGRESS);
    const totalProgress = Math.min(1, autoProgress + scrollContrib);

    // Interpolate rotation from INITIAL_TILT → FINAL_TILT
    model.rotation.x = INITIAL_TILT + (FINAL_TILT - INITIAL_TILT) * totalProgress;

    // Subtle Y-rotation for life
    const idleSwing = Math.sin(now * 0.0006) * 0.08;
    model.rotation.y = idleSwing * totalProgress;
  }

  updateWordReveal();
  renderer.render(scene, camera);
}

requestAnimationFrame(animate);
updateScrollProgress();

// Resize after mount to ensure canvas matches its container
setTimeout(onResize, 100);
