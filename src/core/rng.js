// Deterministic, seeded RNG. All gameplay-affecting randomness in Solar
// Cycle must go through core.rng(streamName) — see ARCHITECTURE.md
// "Determinism". Math.random() is banned outside core bootstrap/tests.

/**
 * mulberry32 — small, fast, good-enough-for-gameplay PRNG.
 * @param {number} seed 32-bit integer seed
 * @returns {() => number} a function returning floats in [0, 1)
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Simple deterministic string hash (FNV-1a) used to derive per-stream seeds. */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * A named-stream RNG registry keyed off one world seed, so e.g. "loot" and
 * "enemies" streams are independently reproducible from the same seed
 * without affecting each other's draw sequence.
 */
export class RngRegistry {
  constructor(worldSeed) {
    this.worldSeed = worldSeed;
    this._streams = new Map();
  }

  stream(name) {
    if (!this._streams.has(name)) {
      const seed = (hashString(`${this.worldSeed}:${name}`) ^ 0x9e3779b9) >>> 0;
      this._streams.set(name, mulberry32(seed));
    }
    return this._streams.get(name);
  }
}
