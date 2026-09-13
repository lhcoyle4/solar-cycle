// Synchronous pub/sub. Cross-module communication happens only through
// this bus or the ECS — never direct imports of another module's
// internals. See ARCHITECTURE.md "Shared world data model".

export class EventBus {
  constructor() {
    this._handlers = new Map();
  }

  on(type, handler) {
    if (!this._handlers.has(type)) this._handlers.set(type, new Set());
    this._handlers.get(type).add(handler);
    return () => this.off(type, handler);
  }

  off(type, handler) {
    this._handlers.get(type)?.delete(handler);
  }

  emit(type, payload) {
    const handlers = this._handlers.get(type);
    if (!handlers) return;
    for (const handler of [...handlers]) {
      // A subscriber throwing must never break the emitter or other
      // subscribers — module isolation applies to event handlers too.
      try {
        handler(payload);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`[eventBus] handler for "${type}" threw`, error);
      }
    }
  }
}
