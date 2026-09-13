# Assets

Every non-procedural asset used by Solar Cycle must be listed here with its
source URL and license. **CC0 only** (Poly Haven, ambientCG, or equivalent
public-domain sources) — no exceptions. Procedurally generated assets
(materials, meshes, textures produced by code in this repo) are noted as
`procedural` with the module that generates them.

No third-party assets have been added yet — `v0.0.1` is bootstrap tooling
only. The `core` boot scene's sky and ground materials are procedural
(generated in-engine from physically-based parameters, no texture files).

| Asset | Source URL | License | Used in |
|-------|-----------|---------|---------|
| Sky shader (Preetham analytic sky model) | https://github.com/mrdoob/three.js — `examples/jsm/objects/Sky.js` | MIT (three.js) — code, not a media asset | `src/environment/index.js` |
| Ground noise texture | procedural (generated at runtime in `src/environment/index.js`, deterministic value noise, no external source) | n/a — procedural | `src/environment/index.js` |
| `favicon.svg` | procedural (hand-authored inline SVG, no external source) | n/a — procedural | `index.html` |
