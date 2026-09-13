# Goal
Build a diablo 2: resurrected class sci-fi/fantasy/cosmic horror action rpg that is set in a world like caves of qud or jack vance dying earth or gene wolfe book of the new sun but gameplay like diablo 2. It is also a roguelike. Take inspiration from H.P. Lovecraft, Mass Effect, Grim Dawn, Caves of Qud, Dying Earth and Neuromancer — but the knowledge of how to use most technologies has been lost. it should also be built in and a focus of the game from the start for all systems to allow the player to make macros and automate things even so far as making a bot. The bar is AAA: photographic PBR materials, physically plausible sun/sky/shadows, atmospheric depth, a living city at night, believable roads and traffic. Never programmer art.

# How to work
1. Architecture first. Before any feature code, write ARCHITECTURE.md: one folder per subsystem (eg core, terrain, environment, materials, characters, animation, combat, enemies, items and loot, skills and classes, world and zones, town, props, effects, simulation, automation (macro/script/bot API), tools, ui, audio, demo zone), a shared world data model, the public API each module must expose, the events it emits, units (metres, +Y up), determinism (seeded RNG only), a performance budget (≥50 fps at 1080p, ≤1500 draw calls) and an asset policy (CC0 only: Poly Haven, ambientCG, or procedural). Isolate module failures so one broken module never takes the game down.
2. Build the verification loop before the game. A headless-Chrome screenshot tool that loads the app, waits until ready, sets a camera preset and time of day, and writes PNG + a JSON log (console errors, fps, draw calls). Every module also ships a "showcase" mode that stages a representative scene of just that module. No agent may claim anything it hasn't screenshotted and looked at.
3. Fan out. Use multi-agent orchestration ("ultracode"). One builder agent per module, each owning only its folder. Run in waves ordered by dependency. Between waves, one integrator agent (the only one allowed to touch core) applies builders' core-change requests and fixes the seams.
4. Gauntlet every module. After each builder round, a separate critic agent (a brutal AAA art director who writes no code) takes its own screenshots at several times of day and zoom levels, checks the API contract, console errors and perf, and scores 0–10 against real Diablo II: Resurrected reference screenshots: 10 = indistinguishable, 8.5 = AAA with nits, 7 = good indie, 5 = programmer art. Pass = ≥8.5 with zero errors. Below that, the builder gets the ranked issue list and goes again, up to 4 rounds.
5. Final gate. A whole-game critic scores the demo zone. Then blind judges get pairs of screenshots labelled only A and B (ours vs. diablo 2: resurrected, order shuffled) and say which looks better and why.
6. /loop until every critic passes. Persist scores and open issues to docs/STATUS.json so each iteration resumes from the weakest module, not from scratch.

# Rules
- Never inflate scores. Report real numbers, failed rounds and what is still missing.
- Never edit another module's folder. Core changes go through the integrator.
- Keep the dev server running and the app loadable at all times; other agents are screenshotting it.
- Do not ask me questions. Make routine decisions yourself, state assumptions, keep going.

Start now.
