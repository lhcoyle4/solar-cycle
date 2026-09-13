# Changelog

All notable changes to Solar Cycle are documented here. Format loosely
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); newest
entries first. Scores are never inflated — real numbers, failed rounds,
and what's still missing are reported as-is.

## [0.0.1] - 2026-09-13

### Added
- `PROMPT.md` — the original design/build brief, verbatim, as the loop's
  source of truth.
- `README.md` — what Solar Cycle is, how the autonomous build loop works,
  versioning, `docs/STATUS.json`, the critique process, and how to run the
  game and its tests once a scaffold exists.
- `ARCHITECTURE.md` — module boundaries (one folder per subsystem), the
  shared world data model, per-module public APIs and emitted events,
  units/coordinate convention, determinism rules, performance budget, and
  the CC0-only asset policy.
- `docs/STATUS.json` — the loop's persistent state: current-run lock,
  per-module score tracking, blind-judging log, next target, and version
  history.
- `scripts/release.sh` — the release script (bump `VERSION`/`package.json`,
  prepend a `CHANGELOG.md` entry, tag, push), with `--dry-run` support.
- `scripts/release.test.sh` — exercises `release.sh` end-to-end in a
  throwaway git repo: version bump, tag creation, changelog ordering,
  dirty-tree refusal, and that `--dry-run` leaves no trace. **Passing.**
- `.gitignore`, `ASSETS.md` (procedural entries only — the sky shader code,
  a runtime-generated ground noise texture, and an inline SVG favicon; no
  third-party assets yet).
- Project scaffold: `package.json`, Vite + Three.js dev setup.
- `src/core/` — the shared world data model: a minimal ECS (`ecs.js`), a
  synchronous event bus (`eventBus.js`), a seeded named-stream RNG
  (`rng.js`, mulberry32), the renderer/scene/camera bootstrap
  (`renderer.js`), and `createCore()` tying them together with per-module
  try/catch isolation (a throwing `init`/`update` disables only that
  module — see ARCHITECTURE.md "Module isolation"). 21 unit tests.
- `src/environment/` — a physically-based (Preetham) sky dome + directional
  sun light driven by a single time-of-day parameter, a fog-atmosphere
  layer, and a deterministic procedural ground texture, with a working
  `showcase()` isolated-scene entry point. 4 unit tests (pure
  `sunElevationDeg` logic).
- `tools/verify/screenshot.mjs` — the verification loop: launches headless
  Chromium (Playwright, using the preinstalled browser), loads the app,
  waits for `window.__SOLAR_READY__`, sets `?scene=<module>&tod=<hours>`,
  and writes a PNG plus a JSON log (console errors/warnings, fps, draw
  calls) to a target directory.
- `docs/critique/v0.0.1.md` + `docs/critique/v0.0.1/*.jpg` — actual
  screenshots from the verification tool, looked at, with an honest
  (unscored — no builder/critic gauntlet has run) assessment.

### Assumptions made
- This is the bootstrap run: no game content exists yet, so there is
  nothing for a builder/critic wave to gauntlet. This release is docs and
  tooling only, exactly as the loop instructions anticipate for `v0.0.1`.
- `docs/STATUS.json` lists `core` and `environment` as the only modules so
  far, both unscored (`score: null`, `round: 0`, `passed: false`) since no
  critic pass has run — only manual verification via the tool (see
  `docs/critique/v0.0.1.md`).
- `next_target` is set to `terrain` — the lowest-level dependency the next
  real builder wave needs (props, town, and characters all need ground to
  stand on).

### Still missing
- Every game module beyond a bare `core` boot scene: terrain, environment,
  materials, characters, animation, combat, enemies, items/loot,
  skills/classes, world/zones, town, props, effects, simulation,
  automation (macro/script/bot API), tools, ui, audio, demo zone.
- Any builder/critic gauntlet round — scores in `docs/STATUS.json` are
  all `null` until the first wave runs.
- The whole-game critic and blind-judging pass (both require a demo zone
  that doesn't exist yet).
