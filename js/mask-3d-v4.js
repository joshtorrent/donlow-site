/* ============================================================
   DON LOW — Persistent 3D mask (Music → Booking)
   Single full-viewport fixed canvas (#mask-3d-canvas) outside
   the scroll frame. Visible only while either Music or Booking
   is on screen; pauses rAF otherwise.

   Two rotation phases:
     1) X-axis entry (same behavior as the old music-3d.js):
        head-down (INITIAL_TILT = 0.55π) → face-camera (0) as the
        user scrolls through Music. Scroll-progress is scaled by
        SPEED=1.7 so the tilt finishes around 60% of Music scroll
        (exactly like the original).
     2) After X is done (progress >= 1), X stays at 0 and Y-axis
        rotation takes over: idle spin at 0.005 rad/frame plus a
        scroll bonus proportional to scroll speed (capped 0.08,
        damped 0.92/frame — eases back to idle in ~800ms).

   Position: locked to a fixed viewport Y fraction (POS_Y_VH) the
   whole time the mask is visible, so the user "carries" the mask
   from Music into Booking with no jump. Scale stays constant at
   BASE_SCALE — same size in both sections.
   ============================================================ */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const canvas = document.getElementById('mask-3d-canvas');
const musicSection   = document.getElementById('music-section');
const bookingSection = document.getElementById('booking-section');
const musicSlot   = document.getElementById('music-3d-slot');
const bookingSlot = document.getElementById('booking-3d-slot');

if (canvas && (musicSection || bookingSection)) init();

function init() {
  // -----------------------------------------------------------
  // CONFIG
  // -----------------------------------------------------------
  const MODEL_URL     = '/assets/music/mask.glb';
  const FOV_DEG       = 30;
  const CAM_Z         = 5;
  const BASE_SCALE    = 1.25;          // same size in Music and Booking
  const POS_Y_VH      = 0.395;         // mask anchored at 39.5% viewport (measured slot center in Music AND Booking)

  // Entry rotation (X-axis) — matches the old music-3d.js exactly
  const INITIAL_TILT  = Math.PI * 0.55; // head-down when entering Music
  const FINAL_TILT    = 0;              // face camera
  const X_SCROLL_SPEED = 1.7;           // >1 so the tilt finishes before Music exits

  // Post-entry rotation (Y-axis)
  const IDLE_ROT_SPEED = 0.005;  // rad/frame idle spin
  const SCROLL_GAIN    = 0.002;  // |deltaScroll| × this → bonus rad/frame
  const BONUS_CAP      = 0.08;
  const BONUS_DAMP     = 0.92;

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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = false;

  scene.add(new THREE.AmbientLight(0xffffff, 1.15));
  const keyLight = new THREE.DirectionalLight(0xfff1d6, 1.8);
  keyLight.position.set(2, 3, 4);
  scene.add(keyLight);

  // -----------------------------------------------------------
  // STATE
  // -----------------------------------------------------------
  let model = null;
  let rafId = null;
  let rendering = false;
  let wantVisible = false;
  let lastScrollTop = 0;
  let scrollBonus = 0;
  let xProgress = 0;   // 0..1 — driven by Music section scroll

  // -----------------------------------------------------------
  // RESIZE
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
  resize();
  setTimeout(resize, 150);

  // -----------------------------------------------------------
  // LOAD MODEL
  // -----------------------------------------------------------
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
      const baseScalar = BASE_SCALE / maxDim;
      model.userData.baseScalar = baseScalar;
      model.scale.setScalar(baseScalar);

      // Start in the entry pose: head-down, ready to lift as user scrolls
      model.rotation.set(INITIAL_TILT, 0, 0);

      scene.add(model);
      evaluateVisibility();
    },
    undefined,
    (err) => console.error('[mask-3d] GLB load failed', err)
  );

  // -----------------------------------------------------------
  // SCROLL TRACKING
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

  // X-entry progress: 0 until the user has actually ENTERED the Music
  // section (rect.top <= 0), then ramps to 1 across the first 60% of
  // the section's height. This keeps the mask out of the testimonials
  // panel above, and makes the tilt start precisely when Music owns
  // the viewport.
  function updateXProgress() {
    if (!musicSection) { xProgress = 1; return; }
    const rect = musicSection.getBoundingClientRect();
    if (rect.top > 0) { xProgress = 0; return; }
    const scrolled = -rect.top;
    // Tilt finishes at 30% of Music section's height (was 0.6 = 60%).
    // Music is one viewport tall, and the natural scroll range between
    // "just arrived" and "starting to reach Booking" is only ~40-50% of
    // that height, so 60% meant the mask was still tilting as the user
    // left the section. 30% means the mask reaches face-camera early,
    // giving the user time to enjoy the portrait pose before Booking.
    const total = rect.height * 0.3;
    xProgress = Math.max(0, Math.min(1, scrolled / total));
  }

  function onScroll() {
    const cur = getScrollTop();
    const delta = cur - lastScrollTop;
    lastScrollTop = cur;
    const bonus = Math.min(BONUS_CAP, Math.abs(delta) * SCROLL_GAIN);
    if (bonus > scrollBonus) scrollBonus = bonus;
    updateXProgress();
    evaluateVisibility();
  }
  (scroller === window ? window : scroller).addEventListener('scroll', onScroll, { passive: true });

  // -----------------------------------------------------------
  // VISIBILITY — mask = "a PNG placed between the title and the
  // artworks". It should exist (be visible) whenever its slot
  // element is intersecting the viewport, and NOT before. That's
  // the exact behavior of a static image in the page layout —
  // visible when its position is visible, invisible otherwise.
  // -----------------------------------------------------------
  function slotIntersectsViewport(el) {
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    return Math.max(0, Math.min(vh, r.bottom) - Math.max(0, r.top));
  }
  function musicEntered()  { return slotIntersectsViewport(musicSlot)   > 0; }
  function bookingInView() { return slotIntersectsViewport(bookingSlot) > 0; }

  // Is Music approaching? (section top within one viewport below)
  // We start the RAF render loop EARLY so the canvas has painted frames
  // ready by the time visibility actually fires — no "blanc" at entry.
  function musicApproaching() {
    if (!musicSection) return false;
    const r = musicSection.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    return r.top < vh && r.bottom > 0;
  }

  function evaluateVisibility() {
    wantVisible = musicEntered() || bookingInView();

    if (wantVisible) {
      canvas.classList.add('mask-3d--visible');
    } else {
      canvas.classList.remove('mask-3d--visible');
    }

    // Keep rendering while music is approaching (even if not yet
    // visible) so first paint is already on-screen when visibility fires.
    const shouldRender = wantVisible || musicApproaching();
    if (shouldRender && !rendering && model) {
      startRender();
    } else if (!shouldRender) {
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
    updateXProgress();
    rafId = requestAnimationFrame(animate);
  }
  function stopRender() {
    rendering = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  // -----------------------------------------------------------
  // ANIMATION LOOP
  // -----------------------------------------------------------
  function animate() {
    if (!rendering) return;
    rafId = requestAnimationFrame(animate);
    if (!model) return;

    // Phase 1: X-axis entry tilt, scroll-linked (same as music-3d.js)
    model.rotation.x = INITIAL_TILT + (FINAL_TILT - INITIAL_TILT) * xProgress;

    // Phase 2: once the tilt is complete, Y-axis rotation takes over.
    // During the entry (xProgress < 1), Y stays at 0 so the lift reads clean.
    if (xProgress >= 1) {
      model.rotation.y += IDLE_ROT_SPEED + scrollBonus;
      scrollBonus *= BONUS_DAMP;
      if (scrollBonus < 0.0005) scrollBonus = 0;
    } else {
      model.rotation.y = 0;
    }

    // Position: two-phase behavior.
    //   Phase 1 — X rotation in progress (xProgress < 1):
    //     Mask stays anchored at a FIXED viewport Y so the rise
    //     animation reads cleanly on the same screen spot.
    //   Phase 2 — X rotation complete (xProgress >= 1):
    //     Mask is "released" and tracks the weighted center of the
    //     music and booking slots. The slots move with scroll, so
    //     the mask scrolls naturally with the content — it now
    //     travels along with the user toward Booking.
    //   Smooth per-frame lerp between the two so the handoff at
    //   xProgress=1 doesn't jump.
    const canvasRect = canvas.getBoundingClientRect();
    const vH = canvasRect.height || window.innerHeight;
    const halfH = Math.tan((FOV_DEG * Math.PI / 180) / 2) * CAM_Z;

    // Mask = "PNG between title and artworks". Target pixel Y is the
    // center of the currently-visible slot. When BOTH slots are
    // intersecting the viewport (during the Music→Booking handoff),
    // use an intersection-area weighted average of the two centers so
    // the mask glides continuously from one slot to the other with NO
    // jump. When only one slot is visible, it's 100% that slot.
    const aM = slotIntersectsViewport(musicSlot);
    const aB = slotIntersectsViewport(bookingSlot);
    const total = aM + aB;
    let targetPx;
    if (total > 0) {
      let sum = 0;
      if (aM > 0 && musicSlot) {
        const r = musicSlot.getBoundingClientRect();
        sum += (r.top + r.height / 2) * (aM / total);
      }
      if (aB > 0 && bookingSlot) {
        const r = bookingSlot.getBoundingClientRect();
        sum += (r.top + r.height / 2) * (aB / total);
      }
      targetPx = sum;
    } else {
      targetPx = POS_Y_VH * vH;
    }
    const pixelInCanvas = targetPx - canvasRect.top;
    const yNdc = 1 - 2 * (pixelInCanvas / vH);
    const targetYWorld = yNdc * halfH;

    // Smooth toward target (per-frame lerp, ~18% catch-up)
    if (model.userData.posY === undefined) model.userData.posY = targetYWorld;
    model.userData.posY += (targetYWorld - model.userData.posY) * 0.18;
    model.position.y = model.userData.posY;

    renderer.render(scene, camera);
  }

  evaluateVisibility();
}
