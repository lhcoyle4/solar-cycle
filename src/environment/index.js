// environment — sky, sun/moon, weather, time-of-day, fog/atmosphere.
// Bootstrap version: a physically-based (Preetham) sky + a sun directional
// light driven by a single time-of-day parameter, plus a procedurally
// textured ground plane so there's a real PBR-lit surface to look at.
//
// See ARCHITECTURE.md for the module contract (init/update/showcase/dispose)
// and the events this module emits.

import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { createRenderContext, readDrawCalls } from '../core/renderer.js';

/** Elevation in degrees for a given hour-of-day (0-24), zenith at noon. */
export function sunElevationDeg(hours) {
  const h = THREE.MathUtils.euclideanModulo(hours, 24);
  // Linear ramp: midnight (0/24) -> -30deg, noon (12) -> 80deg.
  const t = 1 - Math.abs(12 - h) / 12; // 0 at midnight, 1 at noon
  return THREE.MathUtils.lerp(-30, 80, t);
}

/** Builds the sky dome, sun light, and a lit ground plane into `scene`. */
export function buildScene(scene) {
  const sky = new Sky();
  sky.scale.setScalar(45000);
  scene.add(sky);

  const uniforms = sky.material.uniforms;
  uniforms.turbidity.value = 8;
  uniforms.rayleigh.value = 2;
  uniforms.mieCoefficient.value = 0.006;
  uniforms.mieDirectionalG.value = 0.8;

  const sunLight = new THREE.DirectionalLight(0xfff3e0, 3);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 200;
  sunLight.shadow.camera.left = -40;
  sunLight.shadow.camera.right = 40;
  sunLight.shadow.camera.top = 40;
  sunLight.shadow.camera.bottom = -40;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight);
  scene.add(sunLight.target);

  const hemi = new THREE.HemisphereLight(0x9db4c9, 0x1a1712, 0.4);
  scene.add(hemi);

  scene.fog = new THREE.FogExp2(0x8fa3c9, 0.006);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200, 64, 64),
    new THREE.MeshStandardMaterial({
      color: 0x5a5245,
      roughness: 0.92,
      metalness: 0.02,
      map: proceduralGroundTexture(),
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const sunVec = new THREE.Vector3();

  function setTimeOfDay(hours) {
    const elevationDeg = sunElevationDeg(hours);
    const azimuthDeg = 175;
    const phi = THREE.MathUtils.degToRad(90 - elevationDeg);
    const theta = THREE.MathUtils.degToRad(azimuthDeg);
    sunVec.setFromSphericalCoords(1, phi, theta);
    uniforms.sunPosition.value.copy(sunVec);

    sunLight.position.copy(sunVec).multiplyScalar(80);
    sunLight.target.position.set(0, 0, 0);

    const dayFactor = THREE.MathUtils.clamp((elevationDeg + 10) / 90, 0, 1);
    sunLight.intensity = THREE.MathUtils.lerp(0.05, 4.2, dayFactor);
    hemi.intensity = THREE.MathUtils.lerp(0.15, 0.85, dayFactor);
    sunLight.color.setHSL(0.09, 0.6, THREE.MathUtils.lerp(0.55, 0.9, dayFactor));

    return { elevationDeg, azimuthDeg, dayFactor };
  }

  return { sky, sunLight, hemi, ground, setTimeOfDay };
}

/** A small procedural (non-CC0-asset, generated-in-code) noise texture for ground variation. */
function proceduralGroundTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  // Deterministic value noise so the texture doesn't depend on Math.random().
  let seed = 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < size * size; i++) {
    const v = 110 + Math.floor(rand() * 40);
    img.data[i * 4 + 0] = v;
    img.data[i * 4 + 1] = v * 0.94;
    img.data[i * 4 + 2] = v * 0.8;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(20, 20);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const environment = {
  id: 'environment',
  _state: null,

  init(core) {
    if (!core.scene) {
      throw new Error('environment.init requires core.scene (renderer must be attached first)');
    }
    const built = buildScene(core.scene);
    this._state = built;
    built.setTimeOfDay(core.timeOfDay ?? 12);
    core.events.emit('environment:ready', { module: 'environment' });
  },

  update(world, _dt) {
    // Time-of-day is externally driven (see main.js) for the bootstrap
    // scaffold; a full day/night cycle tick lives in simulation/ later.
  },

  /** Stages this module's own isolated scene: sky + sun + ground only. */
  showcase(mountEl, opts = {}) {
    const ctx = createRenderContext(mountEl);
    const built = buildScene(ctx.scene);
    built.setTimeOfDay(opts.timeOfDay ?? 12);

    let raf;
    function frame() {
      ctx.renderer.render(ctx.scene, ctx.camera);
      window.__SOLAR_DEBUG__ = { drawCalls: readDrawCalls(ctx.renderer) };
      raf = requestAnimationFrame(frame);
    }
    frame();

    return {
      ...ctx,
      ...built,
      dispose() {
        cancelAnimationFrame(raf);
        ctx.dispose();
      },
    };
  },

  dispose() {
    this._state = null;
  },
};

export default environment;
