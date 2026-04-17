/* ============================================================
   DON LOW — Music section 3D mask
   Scroll-linked X rotation: starts head-down (cap top visible)
   and rotates up to face the camera as user scrolls through the
   music section. Subtle idle Y bob for life.
   Pauses rAF when off-screen to save battery.
   ============================================================ */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const container = document.getElementById('music-3d-canvas');
if (container) init();

function init() {
  // -----------------------------------------------------------
  // CONFIG
  // -----------------------------------------------------------
  const MODEL_URL    = '/assets/music/mask.glb';
  const SCALE        = 2.6;                 // bigger mask (was 2.0)
  const INITIAL_TILT = Math.PI * 0.55;      // head down, cap top toward camera
  const FINAL_TILT   = 0;                   // face camera

  // -----------------------------------------------------------
  // SETUP
  // -----------------------------------------------------------
  const w0 = container.clientWidth  || 400;
  const h0 = container.clientHeight || 400;

  const scene  = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(30, w0 / h0, 0.1, 100);
  camera.position.set(0, 0, 5);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w0, h0);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  // Lights — warm, light-bg-friendly (no heavy rim)
  scene.add(new THREE.AmbientLight(0xffffff, 1.1));
  const keyLight = new THREE.DirectionalLight(0xffe9c0, 1.9);
  keyLight.position.set(2, 3, 4);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xffd580, 0.9);
  fillLight.position.set(-3, 1, 2);
  scene.add(fillLight);
  const topLight = new THREE.DirectionalLight(0xffffff, 0.7);
  topLight.position.set(0, 5, 2);
  scene.add(topLight);

  // -----------------------------------------------------------
  // LOAD MODEL
  // -----------------------------------------------------------
  let model = null;
  let scrollProgress = 0;
  let inView = true;
  let rafId = null;

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load(
    MODEL_URL,
    (gltf) => {
      model = gltf.scene;

      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);

      model.position.sub(center);

      const maxDim = Math.max(size.x, size.y, size.z);
      model.scale.setScalar(SCALE / maxDim);

      model.rotation.x = INITIAL_TILT;

      scene.add(model);
      container.classList.add('music__3d--ready');
      updateScroll();
    },
    undefined,
    (err) => console.error('Music GLB load failed', err)
  );

  // -----------------------------------------------------------
  // SCROLL TRACKING
  // -----------------------------------------------------------
  // Progress = 0 when the section's top just enters viewport from
  // below, 1 when the section is ~60% of the way through its pass
  // (so the mask reaches face-camera BEFORE the section exits — user
  // can actually see the final portrait pose).
  const SPEED = 1.7;  // >1 = rotation finishes earlier, then stays
  function updateScroll() {
    const section = document.getElementById('music-section');
    if (!section) return;
    const rect = section.getBoundingClientRect();
    const viewportH = window.innerHeight || document.documentElement.clientHeight;
    const total = rect.height + viewportH;
    const scrolled = viewportH - rect.top;
    const raw = scrolled / total;
    scrollProgress = Math.max(0, Math.min(1, raw * SPEED));
  }

  // Listen on whichever element actually scrolls (frame or window)
  const frameEl = document.getElementById('frame');
  let scroller = window;
  if (frameEl) {
    const style = window.getComputedStyle(frameEl);
    if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
      scroller = frameEl;
    }
  }
  scroller.addEventListener('scroll', updateScroll, { passive: true });
  window.addEventListener('resize', onResize);

  function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    updateScroll();
  }

  // -----------------------------------------------------------
  // ANIMATION LOOP
  // -----------------------------------------------------------
  const startTime = performance.now();
  function animate() {
    if (!inView) { rafId = null; return; }
    rafId = requestAnimationFrame(animate);

    if (model) {
      // Scroll-linked X rotation: head down → face camera
      model.rotation.x = INITIAL_TILT + (FINAL_TILT - INITIAL_TILT) * scrollProgress;

      // Subtle idle Y oscillation so the mask feels alive
      const t = (performance.now() - startTime) / 1000;
      model.rotation.y = Math.sin(t * 0.5) * 0.12 * scrollProgress;
      model.position.y = Math.sin(t * 0.6) * 0.04;
    }

    renderer.render(scene, camera);
  }
  rafId = requestAnimationFrame(animate);

  // Pause the rAF loop when the canvas is off-screen
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        inView = e.isIntersecting;
        if (inView && rafId === null) rafId = requestAnimationFrame(animate);
      });
    }, { threshold: 0.05 });
    io.observe(container);
  }

  setTimeout(onResize, 100);
}
