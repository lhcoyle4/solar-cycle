# Solar Cycle

A Diablo II: Resurrected–class action RPG, built as a roguelike, set in a
dying-earth world of lost technology and cosmic horror — inspiration drawn
from H.P. Lovecraft, Mass Effect, Grim Dawn, Caves of Qud, Jack Vance's
Dying Earth, Gene Wolfe's Book of the New Sun, and Neuromancer. Automation
is a first-class citizen: every system exposes a scriptable API so players
can write macros, and eventually bots, against the live game.

Full design and technical direction lives in [`PROMPT.md`](PROMPT.md) (the
original brief, verbatim) and [`ARCHITECTURE.md`](ARCHITECTURE.md) (module
boundaries, the world data model, APIs, events, and budgets).

## This repository builds itself

Solar Cycle is developed by an autonomous, scheduled multi-agent loop, not
by a human typing code. Each run is a fresh session that:

1. Reads [`docs/STATUS.json`](docs/STATUS.json) and the latest file in
   [`docs/critique/`](docs/critique/) to find the weakest module or the next
   dependency wave.
2. Fans out builder agents (one per module folder) and, between waves, a
   single integrator agent that is the only one allowed to touch `core`.
3. Runs a brutal AAA-art-director critic agent against each module's
   "showcase" scene, scoring 0–10 against real Diablo II: Resurrected
   reference screenshots. Passing is ≥8.5 with zero console errors; below
   that the builder gets a ranked issue list and goes again (up to 4 rounds).
4. Persists real scores and open issues back to `docs/STATUS.json` so the
   next run resumes from the weakest point instead of starting over.
5. Releases a new patch/minor version via `scripts/release.sh` whenever
   anything tracked changed, with a `CHANGELOG.md` entry describing what
   changed, the score per module, and what is still missing.

Nothing is ever claimed without evidence: every module ships a headless
Chromium "showcase" mode that the verification tool
(`tools/verify/screenshot.mjs`, once built) loads, screenshots, and logs
console errors / fps / draw calls for. No agent — builder, integrator, or
critic — may assert a visual result it hasn't screenshotted and looked at.

Scores are never inflated. Real numbers, failed rounds, and what's still
missing are recorded honestly in `CHANGELOG.md` and `docs/critique/`.

### Versioning

`VERSION` (mirrored in `package.json` once one exists) follows
`MAJOR.MINOR.PATCH`. PATCH bumps on every run that changes tracked files;
MINOR bumps when the whole-game critic passes a milestone. Each release is
tagged `vX.Y.Z` and published as a GitHub Release with the matching
changelog entry as its body.

### `docs/STATUS.json`

The loop's persistent memory: current run lock (`current_run`), one entry
per module with its latest critic score/round/pass state and open issues,
blind-judging results, the `next_target` the following run should pick up,
and a version history. See the schema comment at the top of the file.

### `docs/critique/`

One markdown report per released version (`docs/critique/v<version>.md`)
with the critic's ranked issues per module, plus up to 10 JPEG screenshots
(≤300 KB each) per round under `docs/critique/v<version>/`. Copyrighted
Diablo II: Resurrected reference screenshots are never committed; scoring
is done against written anchors, the models' own knowledge of the game,
and (if present) `docs/reference/` images supplied directly by the project
owner.

## Running it locally

Once the project scaffold exists (`package.json` present):

```bash
npm install
npm run dev      # start the dev server
npm test         # run the full test suite
npm run verify   # headless-Chrome screenshot + console/fps/draw-call check
```

If `npm run dev` or `package.json` don't exist yet, the loop hasn't
finished bootstrapping — check `VERSION` and `CHANGELOG.md` for the current
state.

## Asset policy

CC0 only (Poly Haven, ambientCG, or procedurally generated). Every asset in
use is listed in [`ASSETS.md`](ASSETS.md) with its source URL and license.
No programmer art, no copyrighted or unlicensed third-party assets.
