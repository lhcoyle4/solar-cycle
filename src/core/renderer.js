// Renderer bootstrap — part of core's job per ARCHITECTURE.md ("scene
// graph root"). Creates the WebGLRenderer/Scene/Camera triple that every
// module renders into (via core.scene) or, for showcase mode, an isolated
// instance of the same triple.

import * as THREE from 'three';

/**
 * @param {HTMLElement} container element to mount the <canvas> into
 * @returns {{renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, clock: THREE.Clock, dispose: () => void}}
 */
export function createRenderContext(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 20000);
  camera.position.set(0, 3.5, 14);
  camera.lookAt(0, 1.8, -60);

  const clock = new THREE.Clock();

  function resize() {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  function dispose() {
    window.removeEventListener('resize', resize);
    renderer.dispose();
    container.removeChild(renderer.domElement);
  }

  return { renderer, scene, camera, clock, resize, dispose };
}

/** Estimate draw calls for the verification tool / perf budget checks. */
export function readDrawCalls(renderer) {
  return renderer.info.render.calls;
}
