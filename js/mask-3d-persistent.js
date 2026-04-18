/* ============================================================
   DON LOW — Persistent 3D mask (Music → Booking)
   Single full-viewport fixed canvas (#mask-3d-canvas) outside
   the scroll frame. Visible only while either the Music or
   Booking section is on screen; pauses rAF otherwise.

   Rotation: Y axis.
     - Idle spin: +0.005 rad / frame (≈5s per revolution @60fps)
     - Scroll bonus: abs(scrollDelta) * 0.002, capped at 0.08
     - Bonus decays per frame (damping 0.92), so it eases back
       to idle within ~800ms after the user stops scrolling.

   Position: mask.position.y tracks the center of either the
   music slot or the booking slot, weighted by how much each
   is on screen. This makes the mask appear to sit inside the
   Music 3D slot, then glide smoothly into the center of the
   Booking section as the user scrolls between them.
   ============================================================ */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const canvas = document.getElementById('mask-3d-canvas');
const musicSlot   = document.getElementById('music-3d-slot');
const bookingSlot = document.getElementById('booking-3d-slot');

if (canvas && (musicSlot || bookingSlot)) init();

function init() {
  // -----------------------------------------------------------
  // CONFIG
  // -----------------------------------------------------------
  const MODEL_URL    = '/assets/music/mask.glb';
  const FOV_DEG      = 30;
  const CAM_Z        = 5;
  // Scale retuned for the fullscreen canvas (was 2.6 when canvas was only
  // 48dvh tall; at 100dvh the mask would fill the whole viewport). Target
  // ~45% of viewport height in Music view, ~25% in Booking (cards need room).
  const BASE_SCALE   = 1.25;
  const BOOKING_SCALE_MULT = 0.55;

  const IDLE_ROT_SPEED = 0.005;  // rad/frame idle spin
  const SCROLL_GAIN    = 0.002;  // multiplier on |deltaScroll| for bonus
  const BONUS_CAP      = 0.08;   // max added rad/frame
  const BONUS_DAMP     = 0.92;   // per-frame damping of scroll bonus

  // -----------------------------------------------------------
  // SETUP
  // -----------------------------------------------------------
  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(FOV_DEG, 1, 0.1, 100);
  camera.position.set(0, 0, CAM_Z);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));  // mobile-friendly
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = false;

  // Lights — one ambient + one directional (cheap, mobile-safe)
  scene.add(new THREE.AmbientLight(0xffffff, 1.15));
  const keyLight = new THREE.DirectionalLight(0xfff1d6, 1.8);
  keyLight.position.set(2, 3, 4);
  scene.add(keyLight);

  // -----------------------------------------------------------
  // STATE
  // -----------------------------------------------------------
  let model = null;
  let rafId = null;
  let rendering = false;    // whether the RAF loop is running
  let wantVisible = false;  // whether at least one target slot is on screen
  let lastScrollTop = 0;
  let scrollBonus = 0;      // current added Y rotation per frame
  let currentScale = BASE_SCALE;

  // -----------------------------------------------------------
  // RESIZE — canvas matches the fixed element's displayed size
  // -----------------------------------------------------------
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  // Initial + late resize (fonts/layout)
  resize();
  setTimeout(resize, 150);

  // -----------------------------------------------------------
  // LOAD MODEL
  // -----------------------------------------------------------
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);  // GLB is gltfpack meshopt-compressed
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
      const baseScalar = BASE_SCALE / maxDim;
      model.userData.baseScalar = baseScalar;
      model.scale.setScalar(baseScalar);

      // Default orientation: face camera, Y-up
      model.rotation.set(0, 0, 0);

      scene.add(model);
      evaluateVisibility();   // kick the loop if already on a target section
    },
    undefined,
    (err) => console.error('[mask-3d] GLB load failed', err)
  );

  // -----------------------------------------------------------
  // SCROLL TRACKING — scroller is .frame (desktop) or window
  // -----------------------------------------------------------
  const frame = document.getElementById('frame');
  let scroller = window;
  if (frame) {
    const s = window.getComputedStyle(frame);
    if (s.overflowY === 'auto' || s.overflowY === 'scroll') scroller = frame;
  }
  function getScrollTop() {
    return scroller === window
      ? (window.pageYOffset || document.documentElement.scrollTop || 0)
      : scroller.scrollTop;
  }

  function onScroll() {
    const cur = getScrollTop();
    const delta = cur - lastScrollTop;
    lastScrollTop = cur;
    // Bump scroll bonus proportional to scroll speed, capped
    const bonus = Math.min(BONUS_CAP, Math.abs(delta) * SCROLL_GAIN);
    if (bonus > scrollBonus) scrollBonus = bonus;
    evaluateVisibility();
  }
  (scroller === window ? window : scroller).addEventListener('scroll', onScroll, { passive: true });

  // -----------------------------------------------------------
  // VISIBILITY — fade canvas in/out based on slot intersection
  // -----------------------------------------------------------
  function slotWeight(el) {
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const visible = Math.min(vh, r.bottom) - Math.max(0, r.top);
    return Math.max(0, visible);
  }

  function evaluateVisibility() {
    const wM = slotWeight(musicSlot);
    const wB = slotWeight(bookingSlot);
    wantVisible = (wM + wB) > 0;

    if (wantVisible) {
      canvas.classList.add('mask-3d--visible');
      if (!rendering && model) startRender();
    } else {
      canvas.classList.remove('mask-3d--visible');
      // Don't stop rendering immediately — let fade-out complete.
      // A short delay also covers quick scroll-past cases.
      scheduleStopIfHidden();
    }
  }

  let stopTimer = null;
  function scheduleStopIfHidden() {
    if (stopTimer) clearTimeout(stopTimer);
    stopTimer = setTimeout(() => {
      if (!wantVisible) stopRender();
    }, 500);
  }

  function startRender() {
    if (rendering) return;
    rendering = true;
    lastScrollTop = getScrollTop();
    rafId = requestAnimationFrame(animate);
  }
  function stopRender() {
    rendering = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  // -----------------------------------------------------------
  // ANIMATION LOOP — rotate + position + render
  // -----------------------------------------------------------
  function animate() {
    if (!rendering) return;
    rafId = requestAnimationFrame(animate);
    if (!model) return;

    // Rotation: idle + bonus, bonus decays each frame
    model.rotation.y += IDLE_ROT_SPEED + scrollBonus;
    scrollBonus *= BONUS_DAMP;
    if (scrollBonus < 0.0005) scrollBonus = 0;

    // Position the mask so it appears at the weighted slot center
    const wM = slotWeight(musicSlot);
    const wB = slotWeight(bookingSlot);
    const total = wM + wB;
    if (total > 0) {
      // Weighted pixel center
      let targetPx = 0;
      if (musicSlot) {
        const r = musicSlot.getBoundingClientRect();
        targetPx += (r.top + r.height / 2) * (wM / total);
      }
      if (bookingSlot) {
        const r = bookingSlot.getBoundingClientRect();
        targetPx += (r.top + r.height / 2) * (wB / total);
      }

      // Convert target pixel Y to world Y at z=0 plane
      const canvasRect = canvas.getBoundingClientRect();
      const vH = canvasRect.height || window.innerHeight;
      const halfH = Math.tan((FOV_DEG * Math.PI / 180) / 2) * CAM_Z;
      // Transform: pixel Y within canvas (0..vH) → NDC Y (+1..-1) → world Y
      const pixelInCanvas = targetPx - canvasRect.top;
      const yNdc = 1 - 2 * (pixelInCanvas / vH);
      model.position.y = yNdc * halfH;

      // Scale interpolation: smaller in booking, base in music
      const bookingFrac = wB / total;
      const scaleMult = 1 + (BOOKING_SCALE_MULT - 1) * bookingFrac;
      const targetScale = (model.userData.baseScalar || 1) * scaleMult;
      // Smooth toward target (per-frame lerp)
      const cur = model.scale.x;
      const next = cur + (targetScale - cur) * 0.12;
      model.scale.setScalar(next);
    }

    renderer.render(scene, camera);
  }

  // Kick visibility evaluation on load (in case we're already mid-page)
  evaluateVisibility();
}
