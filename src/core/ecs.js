// Minimal ECS: entities are numeric IDs, components are plain data objects
// keyed by component type, systems are `(world, dt) => void` functions
// registered against the tick loop. See ARCHITECTURE.md.

export class World {
  constructor() {
    this._nextEntityId = 1;
    this.components = new Map(); // componentType -> Map<entityId, data>
    this.systems = [];
    this.zoneId = null;
    this.clock = 0; // in-game seconds
  }

  createEntity() {
    return this._nextEntityId++;
  }

  destroyEntity(entityId) {
    for (const store of this.components.values()) {
      store.delete(entityId);
    }
  }

  addComponent(entityId, type, data) {
    if (!this.components.has(type)) this.components.set(type, new Map());
    this.components.get(type).set(entityId, data);
    return data;
  }

  getComponent(entityId, type) {
    return this.components.get(type)?.get(entityId);
  }

  removeComponent(entityId, type) {
    this.components.get(type)?.delete(entityId);
  }

  /** Iterate [entityId, data] pairs for a component type. */
  *query(type) {
    const store = this.components.get(type);
    if (!store) return;
    yield* store.entries();
  }

  registerSystem(fn) {
    this.systems.push(fn);
    return () => {
      this.systems = this.systems.filter((s) => s !== fn);
    };
  }

  tick(dt) {
    this.clock += dt;
    for (const system of this.systems) {
      system(this, dt);
    }
  }
}
