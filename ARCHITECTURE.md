# Architecture

Solar Cycle is a browser-based, WebGL/WebGPU-class 3D action RPG. This
document is the contract every module builder and the integrator work
against. It is written before feature code exists and updated only by the
integrator, on behalf of a builder's core-change request.

## Module layout

One folder per subsystem under `src/`. A builder agent owns exactly one
folder and never edits another's. Core changes (the shared data model,
event bus, ECS, renderer bootstrap) go through the integrator only.

```
src/
  core/          world data model, ECS, event bus, RNG, save/load, scene graph root
  terrain/       heightfields, biomes, navmesh generation
  environment/   sky, sun/moon, weather, time-of-day, fog/atmosphere
  materials/     PBR material library, texture/procedural-material pipeline
  characters/    player + NPC rigs, skeletons, customization
  animation/     animation state machines, IK, blending
  combat/        hit detection, damage pipeline, status effects
  enemies/       enemy AI, spawn tables, behavior trees
  items/         item generation, affixes, loot tables, inventory
  skills/        class/skill trees, ability definitions, cooldowns
  world/         zone graph, level streaming, seeded procedural layout
  town/          town hub scenes, NPCs, vendors, waypoints
  props/         static/interactive set-dressing meshes
  effects/       VFX (particles, shaders, decals), SFX triggers
  simulation/    day/night cycle tick, traffic/crowd sim, ambient life
  automation/    macro recorder/player, scripting API, bot harness
  tools/         editor/debug tooling, level/asset inspectors
  ui/            HUD, menus, inventory UI, minimap
  audio/         music/ambience/SFX mixing, spatial audio
  demo/          the demo zone: composes all modules into one playable scene
tools/verify/    headless-Chrome screenshot + console/fps/draw-call harness
scripts/         release tooling
docs/            STATUS.json, critique reports, reference images (owner-supplied only)
```

Each module folder must contain a `README.md` describing its public API,
the events it emits/consumes, and its `showcase()` entry point (see
"Showcase mode" below). Each module ships unit tests alongside its code.

## Shared world data model (owned by `core`)

`core` defines and owns:

- **ECS**: entities are plain numeric IDs; components are plain data
  objects keyed by component type; systems are pure functions
  `(world, dt) => void` registered against the tick loop. No module may
  invent a second entity/component system — extend `core`'s via a
  core-change request.
- **Event bus**: a synchronous pub/sub (`core.events.emit(type, payload)`,
  `core.events.on(type, handler)`). Cross-module communication happens
  only through events or the ECS, never direct imports of another
  module's internals.
- **World state**: `core.world` holds the current zone id, entity table,
  clock (in-game seconds), and the active seeded RNG stream(s). Modules
  read it; only `core` and `world/` mutate zone/clock state directly.
- **RNG**: all randomness goes through `core.rng(streamName)`, a seeded
  PRNG (mulberry32 or xoshiro128**) keyed by stream name so e.g. loot rolls
  and enemy spawns are independently reproducible from the same world
  seed. `Math.random()` is banned outside of `core` bootstrap/test fixtures.

## Public API convention

Every module exports a single default object from its `index.js`/`index.ts`
with (at minimum):

```js
export default {
  id: 'terrain',                 // matches folder name
  init(core) {},                 // wire up systems/listeners against core
  update(world, dt) {},          // optional per-tick hook
  showcase(mountEl, opts) {},    // stages this module's representative scene
  dispose() {},                  // tear down listeners/GPU resources
}
```

- `init(core)` receives the shared `core` API surface (event bus, ECS
  registration, RNG, asset loader) — never a reference to another
  module's internals.
- Modules emit events under a namespaced type: `"combat:hit"`,
  `"loot:dropped"`, `"zone:entered"`. Consumers subscribe via
  `core.events.on(...)`; the emitting module's `README.md` documents every
  event type and payload shape it emits.
- A module that throws during `init`, `update`, or `showcase` is caught at
  the call site and logged, not allowed to crash the process — see
  "Module isolation" below.

## Units & convention

- Metres, +Y up, right-handed coordinate system (matches Three.js/glTF
  default).
- Time: in-game seconds as a float on `core.world.clock`; real-time delta
  passed to `update(world, dt)` in seconds.
- Rotations: radians internally; quaternions for storage, Euler only at
  authoring/debug boundaries.

## Determinism

- Seeded RNG only (see above) — no unseeded `Math.random()`, no
  wall-clock-seeded randomness in gameplay-affecting code.
- A world seed (string or number) determines terrain, loot, and spawn
  generation deterministically: same seed → same zone.
- Frame-rate-independent simulation: gameplay logic ticks on a fixed
  timestep accumulator in `core`; rendering interpolates.

## Performance budget

- ≥50 fps at 1080p on the target showcase scenes (measured; headless
  Chromium in this environment renders WebGL in software, so fps figures
  from CI are reported honestly as advisory-only — draw calls and error
  count are the hard gates there).
- ≤1500 draw calls per frame in the demo zone. Modules must batch/instance
  geometry (instanced meshes for foliage, props, crowd) rather than one
  draw call per object.
- Texture budget: PBR sets stay within a per-material memory budget noted
  in each module's `README.md`; prefer texture atlases for like materials.

## Asset policy

CC0 only — Poly Haven, ambientCG, or procedurally generated in-engine.
Every non-procedural asset is listed in `ASSETS.md` with source URL and
license before it is used. No programmer art (flat-color primitives are
only acceptable as temporary placeholders explicitly marked `TODO` in the
module's issue list, never shipped in a release that claims a passing
critic score for that module).

## Module isolation

- Each module's `init`/`update`/`showcase` calls are wrapped by `core` in
  a try/catch that logs the error (via `core.events.emit('module:error',
  {id, error})`) and disables further ticks for that module, rather than
  throwing up the stack. One broken module degrades a scene; it never
  takes down the app.
- The dev server and the app's ability to load must survive a broken
  module. The verification tool's console-error check treats a caught
  `module:error` event as a logged failure for that module's score, not a
  process crash.

## Verification loop

`tools/verify/screenshot.mjs` (Playwright + the preinstalled headless
Chromium) loads the app at a given URL, waits for `window.__SOLAR_READY__
=== true`, optionally sets a camera preset and time-of-day via query
params (`?scene=<module>&camera=<preset>&tod=<0..24>`), then:

- Takes a PNG screenshot.
- Writes a JSON log: console errors/warnings captured during load, the
  measured fps over a short sample window, and an estimated draw-call
  count (read from a debug counter the renderer exposes on
  `window.__SOLAR_DEBUG__.drawCalls`).

Every module's `showcase(mountEl, opts)` stages a representative scene of
just that module (e.g. `terrain.showcase()` renders a heightfield tile with
no other systems active) so the critic can gauntlet modules independently
before they're composed into the demo zone.

No agent may report a visual result — "looks good", "materials read as
PBR", "no popping" — without having actually run the verification tool and
looked at the PNG it produced.

## Automation / macro / bot API (`automation/`)

First-class from the start, not bolted on:

- **Recorder**: captures input + resulting game-state deltas as a
  reversible event log (`core.events` stream), replayable deterministically
  given the same world seed.
- **Macro API**: a sandboxed scripting surface (`automation.script`)
  exposing read access to world state and a constrained set of player
  actions (move, use-skill, use-item, target) — no direct DOM/network
  access from user scripts.
- **Bot harness**: a headless driver that runs a macro script against a
  running world instance without a human in the loop, for testing macros
  and, eventually, for players who want to build their own bots. Bots are
  rate/action-limited identically to human input — no unfair advantage
  baked into the API surface.

## Critic scoring

Scores are 0–10 against real Diablo II: Resurrected reference screenshots
(or, absent copyrighted references, the written anchors in this document
plus the critic's own knowledge of the game): 10 = indistinguishable, 8.5 =
AAA with nits, 7 = good indie, 5 = programmer art. Pass = ≥8.5 **and** zero
console errors. Results and ranked open issues persist to
`docs/STATUS.json` per module, and to `docs/critique/v<version>.md` per
release.
