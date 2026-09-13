import { describe, it, expect, vi } from 'vitest';
import { createCore } from './index.js';
import { mulberry32, hashString, RngRegistry } from './rng.js';
import { EventBus } from './eventBus.js';
import { World } from './ecs.js';

describe('rng', () => {
  it('mulberry32 is deterministic for a given seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('mulberry32 produces values in [0, 1)', () => {
    const rand = mulberry32(1);
    for (let i = 0; i < 100; i++) {
      const v = rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('different seeds diverge', () => {
    const a = mulberry32(1)();
    const b = mulberry32(2)();
    expect(a).not.toEqual(b);
  });

  it('hashString is deterministic', () => {
    expect(hashString('loot')).toEqual(hashString('loot'));
    expect(hashString('loot')).not.toEqual(hashString('enemies'));
  });

  it('RngRegistry gives independent, reproducible streams per name', () => {
    const reg1 = new RngRegistry('seed-a');
    const reg2 = new RngRegistry('seed-a');
    const lootA = reg1.stream('loot');
    const lootB = reg2.stream('loot');
    expect(lootA()).toEqual(lootB());

    const reg3 = new RngRegistry('seed-a');
    const loot = reg3.stream('loot');
    const enemies = reg3.stream('enemies');
    expect(loot()).not.toEqual(enemies());
  });

  it('RngRegistry with a different world seed diverges', () => {
    const regA = new RngRegistry('seed-a');
    const regB = new RngRegistry('seed-b');
    expect(regA.stream('loot')()).not.toEqual(regB.stream('loot')());
  });
});

describe('EventBus', () => {
  it('delivers emitted payloads to subscribers', () => {
    const bus = new EventBus();
    const received = [];
    bus.on('combat:hit', (payload) => received.push(payload));
    bus.emit('combat:hit', { dmg: 10 });
    expect(received).toEqual([{ dmg: 10 }]);
  });

  it('off() unsubscribes', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const unsub = bus.on('x', handler);
    unsub();
    bus.emit('x', {});
    expect(handler).not.toHaveBeenCalled();
  });

  it('a throwing handler does not stop other handlers', () => {
    const bus = new EventBus();
    const good = vi.fn();
    bus.on('x', () => {
      throw new Error('boom');
    });
    bus.on('x', good);
    expect(() => bus.emit('x', {})).not.toThrow();
    expect(good).toHaveBeenCalled();
  });

  it('emit with no subscribers is a no-op', () => {
    const bus = new EventBus();
    expect(() => bus.emit('nobody:listening', {})).not.toThrow();
  });
});

describe('World (ECS)', () => {
  it('creates entities with increasing ids', () => {
    const world = new World();
    const a = world.createEntity();
    const b = world.createEntity();
    expect(b).toBeGreaterThan(a);
  });

  it('adds, gets, and removes components', () => {
    const world = new World();
    const e = world.createEntity();
    world.addComponent(e, 'position', { x: 1, y: 2, z: 3 });
    expect(world.getComponent(e, 'position')).toEqual({ x: 1, y: 2, z: 3 });
    world.removeComponent(e, 'position');
    expect(world.getComponent(e, 'position')).toBeUndefined();
  });

  it('destroyEntity clears all of an entity\'s components', () => {
    const world = new World();
    const e = world.createEntity();
    world.addComponent(e, 'position', { x: 0, y: 0, z: 0 });
    world.addComponent(e, 'health', { hp: 10 });
    world.destroyEntity(e);
    expect(world.getComponent(e, 'position')).toBeUndefined();
    expect(world.getComponent(e, 'health')).toBeUndefined();
  });

  it('query iterates all entities with a component type', () => {
    const world = new World();
    const e1 = world.createEntity();
    const e2 = world.createEntity();
    world.addComponent(e1, 'health', { hp: 10 });
    world.addComponent(e2, 'health', { hp: 20 });
    const results = [...world.query('health')];
    expect(results).toHaveLength(2);
    expect(new Set(results.map(([id]) => id))).toEqual(new Set([e1, e2]));
  });

  it('registerSystem runs on tick and can be unregistered', () => {
    const world = new World();
    const calls = [];
    const unregister = world.registerSystem((w, dt) => calls.push(dt));
    world.tick(0.5);
    expect(calls).toEqual([0.5]);
    unregister();
    world.tick(0.5);
    expect(calls).toEqual([0.5]);
  });

  it('tick advances the clock', () => {
    const world = new World();
    world.tick(0.5);
    world.tick(0.25);
    expect(world.clock).toBeCloseTo(0.75);
  });
});

describe('createCore', () => {
  it('initializes a module and exposes it via getModule/listModules', () => {
    const core = createCore('test-seed');
    const initSpy = vi.fn();
    core.registerModule({ id: 'fake', init: initSpy });
    expect(initSpy).toHaveBeenCalledWith(core);
    expect(core.getModule('fake')).toBeDefined();
    expect(core.listModules()).toContain('fake');
    expect(core.isModuleHealthy('fake')).toBe(true);
  });

  it('registerModule requires a string id', () => {
    const core = createCore();
    expect(() => core.registerModule({})).toThrow();
  });

  it('isolates a module whose init() throws instead of crashing core', () => {
    const core = createCore();
    const errors = [];
    core.events.on('module:error', (e) => errors.push(e));
    expect(() =>
      core.registerModule({
        id: 'broken',
        init() {
          throw new Error('boom');
        },
      })
    ).not.toThrow();
    expect(core.isModuleHealthy('broken')).toBe(false);
    expect(errors).toHaveLength(1);
    expect(errors[0].id).toBe('broken');
  });

  it('isolates a module whose update() throws on tick, without disabling others', () => {
    const core = createCore();
    const goodUpdate = vi.fn();
    core.registerModule({
      id: 'broken',
      update() {
        throw new Error('boom');
      },
    });
    core.registerModule({ id: 'good', update: goodUpdate });

    core.tick(0.016);
    expect(core.isModuleHealthy('broken')).toBe(false);
    expect(core.isModuleHealthy('good')).toBe(true);
    expect(goodUpdate).toHaveBeenCalledTimes(1);

    // Ticking again must not re-throw for the already-disabled module.
    core.tick(0.016);
    expect(goodUpdate).toHaveBeenCalledTimes(2);
  });

  it('rng streams are reproducible for the same world seed', () => {
    const coreA = createCore('same-seed');
    const coreB = createCore('same-seed');
    expect(coreA.rng('loot')()).toEqual(coreB.rng('loot')());
  });
});
