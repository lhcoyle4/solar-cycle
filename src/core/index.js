// core — the only module allowed to own the shared world data model.
// Every other module receives this API via init(core) and communicates
// only through it. See ARCHITECTURE.md "Shared world data model".

import { EventBus } from './eventBus.js';
import { World } from './ecs.js';
import { RngRegistry } from './rng.js';

const FIXED_TIMESTEP = 1 / 60; // seconds — gameplay ticks at a fixed rate

export function createCore(worldSeed = 'solar-cycle-dev') {
  const events = new EventBus();
  const world = new World();
  const rngRegistry = new RngRegistry(worldSeed);

  const modules = new Map(); // id -> module
  const disabledModules = new Set();

  /** Run fn, and on throw, disable the named module and emit module:error instead of crashing. */
  function isolate(moduleId, fn) {
    if (disabledModules.has(moduleId)) return;
    try {
      fn();
    } catch (error) {
      disabledModules.add(moduleId);
      // eslint-disable-next-line no-console
      console.error(`[core] module "${moduleId}" failed, disabling it`, error);
      events.emit('module:error', { id: moduleId, error: String(error?.stack || error) });
    }
  }

  const core = {
    events,
    world,
    rng: (streamName) => rngRegistry.stream(streamName),
    worldSeed,
    scene: null,
    camera: null,
    renderer: null,
    timeOfDay: 12,

    /** Attach the renderer/scene/camera triple (see core/renderer.js) so modules can add to core.scene. */
    attachRenderer(renderContext) {
      this.scene = renderContext.scene;
      this.camera = renderContext.camera;
      this.renderer = renderContext.renderer;
    },

    setTimeOfDay(hours) {
      this.timeOfDay = hours;
      events.emit('environment:timeOfDay', { hours });
    },

    registerModule(module) {
      if (!module || typeof module.id !== 'string') {
        throw new Error('registerModule: module must have a string id');
      }
      modules.set(module.id, module);
      isolate(module.id, () => module.init?.(core));
    },

    getModule(id) {
      return modules.get(id);
    },

    listModules() {
      return [...modules.keys()];
    },

    isModuleHealthy(id) {
      return modules.has(id) && !disabledModules.has(id);
    },

    /** Advance all healthy modules + ECS systems by dt seconds (fixed timestep). */
    tick(dt) {
      world.tick(dt);
      for (const [id, module] of modules) {
        isolate(id, () => module.update?.(world, dt));
      }
    },

    fixedTimestep: FIXED_TIMESTEP,
  };

  return core;
}
