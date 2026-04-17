/* ============================================================
   DON LOW — Music section 3D mask
   Slow continuous rotation + gentle vertical bob. Plays when the
   music section is visible; pauses when off-screen to save battery.
   ============================================================ */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const container = document.getElementById('music-3d-canvas');
if (container) init();

function init() {
  const w0 = container.clientWidth  || 400;
  const h0 = container.clientHeight || 400;

  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(30, w0 / h0, 0.1, 100);
  camera.position.set(0, 0, 5);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w0, h0);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  // Lights — warm, moody
  scene.add(new THREE.AmbientLight(0xffffff, 0.95));
  const keyLight = new THREE.DirectionalLight(0xffe9c0, 2.0);
  keyLight.position.set(2, 3, 4);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xffd580, 0.8);
  fillLight.position.set(-3, 1, 2);
  scene.add(fillLight);
  const rimLight = new THREE.DirectionalLight(0xa83030, 0.6);
  rimLight.position.set(0, -2, -3);
  scene.add(rimLight);

  let model = null;
  let inView = true;
  let rafId = null;

  const loader = new GLTFLoader();
  loader.load(
    '/assets/music/mask.glb',
    (gltf) => {
      model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      model.position.sub(center);
      const maxDim = Math.max(size.x, size.y, size.z);
      model.scale.setScalar(2.0 / maxDim);
      model.rotation.x = -0.15;
      scene.add(model);
      container.classList.add('music__3d--ready');
    },
    undefined,
    (err) => console.error('Music GLB load failed', err)
  );

  function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);

  const start = performance.now();
  function animate() {
    if (!inView) { rafId = null; return; }
    rafId = requestAnimationFrame(animate);
    if (model) {
      const t = (performance.now() - start) / 1000;
      model.rotation.y = t * 0.32;   // one full rotation ~ 20s
      model.position.y = Math.sin(t * 0.6) * 0.05;
    }
    renderer.render(scene, camera);
  }
  rafId = requestAnimationFrame(animate);

  // Pause when off-screen
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
