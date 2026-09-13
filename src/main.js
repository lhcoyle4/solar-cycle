// Entry point. Boots core + the renderer, registers modules, and runs the
// main loop. Supports the verification tool's query params:
//   ?scene=<moduleId>   — run that module's showcase() in isolation
//   ?tod=<0..24>         — time of day (hours), default 12
//
// With no ?scene, boots the composed "core boot" scene (currently just
// environment, until more modules exist).

import { createCore } from './core/index.js';
import { createRenderContext, readDrawCalls } from './core/renderer.js';
import environment from './environment/index.js';

const MODULES = { environment };

const params = new URLSearchParams(window.location.search);
const sceneParam = params.get('scene');
const timeOfDay = params.has('tod') ? Number(params.get('tod')) : 12;

const appEl = document.getElementById('app');
const hudEl = document.getElementById('hud');

window.__SOLAR_READY__ = false;
window.__SOLAR_DEBUG__ = { drawCalls: 0, consoleErrors: [] };

// The verification tool reads console errors independently via the CDP
// console API, but we also mirror a count here for in-page HUD/debug use.
window.addEventListener('error', (e) => {
  window.__SOLAR_DEBUG__.consoleErrors.push(String(e.error?.stack || e.message));
});

function runShowcase(moduleId) {
  const module = MODULES[moduleId];
  if (!module || typeof module.showcase !== 'function') {
    hudEl.textContent = `Unknown showcase module: ${moduleId}`;
    window.__SOLAR_READY__ = true; // let the verification tool still capture the error state
    return;
  }
  const instance = module.showcase(appEl, { timeOfDay });
  hudEl.textContent = `showcase: ${moduleId} | tod=${timeOfDay}`;
  window.__SOLAR_READY__ = true;
  return instance;
}

function runComposedBoot() {
  const core = createCore('solar-cycle-dev-seed');
  const renderCtx = createRenderContext(appEl);
  core.attachRenderer(renderCtx);

  core.registerModule(environment);
  core.setTimeOfDay(timeOfDay);
  const envModule = core.getModule('environment');
  envModule?._state?.setTimeOfDay(timeOfDay);

  core.events.on('module:error', ({ id, error }) => {
    hudEl.textContent = `module "${id}" failed — see console`;
    // eslint-disable-next-line no-console
    console.error(`[main] module:error`, id, error);
  });

  let last = performance.now();
  let frames = 0;
  let fpsAcc = 0;
  let fps = 0;

  function frame() {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;

    core.tick(dt);
    renderCtx.renderer.render(renderCtx.scene, renderCtx.camera);

    window.__SOLAR_DEBUG__.drawCalls = readDrawCalls(renderCtx.renderer);

    frames++;
    fpsAcc += dt;
    if (fpsAcc >= 0.5) {
      fps = Math.round(frames / fpsAcc);
      frames = 0;
      fpsAcc = 0;
      hudEl.textContent = `Solar Cycle v0.0.1 | tod=${timeOfDay} | fps~${fps} | draws=${window.__SOLAR_DEBUG__.drawCalls} | modules=${core.listModules().join(',')}`;
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(() => {
    frame();
    window.__SOLAR_READY__ = true;
  });

  return { core, renderCtx };
}

if (sceneParam) {
  runShowcase(sceneParam);
} else {
  runComposedBoot();
}
