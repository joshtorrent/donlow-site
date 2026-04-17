/* ============================================================
   DON LOW — World Wide Reach
   3D mask rotating slowly in the hero background
   ============================================================ */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const container = document.getElementById('reach-3d-canvas');
if (container) init();

function init() {
  const w0 = container.clientWidth  || 400;
  const h0 = container.clientHeight || 600;

  // Scene
  const scene = new THREE.Scene();
  scene.background = null;

  // Camera
  const camera = new THREE.PerspectiveCamera(30, w0 / h0, 0.1, 100);
  camera.position.set(0, 0, 5);

  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w0, h0);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  // Lights — warm, moody (subtle — this is a background)
  const ambient = new THREE.AmbientLight(0xffffff, 0.9);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xffe9c0, 2.0);
  keyLight.position.set(2, 3, 4);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xffd580, 0.8);
  fillLight.position.set(-3, 1, 2);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xa83030, 0.6);
  rimLight.position.set(0, -2, -3);
  scene.add(rimLight);

  // Load GLB
  let model = null;
  const loader = new GLTFLoader();
  loader.load(
    '/assets/worldwide/mask.glb',
    (gltf) => {
      model = gltf.scene;

      // Auto-fit
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);

      model.position.sub(center);

      const maxDim = Math.max(size.x, size.y, size.z);
      model.scale.setScalar(2.0 / maxDim);

      // Slight upward tilt — more "heroic" angle for background
      model.rotation.x = -0.15;

      scene.add(model);

      // Fade the canvas in
      container.classList.add('reach-hero__3d--ready');
    },
    undefined,
    (err) => {
      console.error('GLB load failed', err);
    }
  );

  // Resize
  function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);

  // Animation loop — continuous slow Y rotation
  const start = performance.now();
  function animate() {
    requestAnimationFrame(animate);
    if (model) {
      const t = (performance.now() - start) / 1000;
      // Slow rotation — full cycle ~20s
      model.rotation.y = t * 0.32;
      // Gentle bob
      model.position.y = Math.sin(t * 0.6) * 0.05;
    }
    renderer.render(scene, camera);
  }
  animate();

  // Re-fit after initial paint
  setTimeout(onResize, 100);
}
