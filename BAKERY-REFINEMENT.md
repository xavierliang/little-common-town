# Refined bakery v6

Historical measurements for v6. The subsequent v7 lower-face correction is documented in [BAKERY-CHIN-FIX.md](BAKERY-CHIN-FIX.md); current runtime hashes and sizes are in public/models/bakery/runtime-manifest.json.

This release completes the asset refinement inside the playable bakery chapter. The seven-day decisions, cash/time ledger, consent rules, saves and original town sandbox are unchanged.

## Visible changes

- Both original characters have refined faces/hair and clothing craftsmanship, including apron seams, accessories and small tools, with the same 1.6 m scale and 18-bone rigs.
- The bakery has shaped roof tiles, a real oven opening, scored bread/croissants, finer display trays, selective woodwork and rounded tree crowns.
- The kneading table is corrected from shoulder height to a 0.83 m worktop; dough is at 0.90 m. Natural Work poses reach the actual table instead of moving under it or raising fists unnaturally.
- Counter greetings and completed-action poses show faces; active tool interactions face the workstation. Delivery motion holds the basket still on arrival.
- Focused framing projects a 1.6 m character to approximately 84 pixels high at a 390 px wide viewport under the configured camera. This is a projection calculation, not a phone screenshot or performance benchmark. Action framing follows the pair; the overview button still shows the full diorama.
- Runtime filenames contain content hashes so old cached models are not reused after this update. Previous unversioned asset URLs remain available for already-open v5 tabs; the new app only loads the refined files listed in runtime-manifest.json.

## Compatibility and checks

The exact Idle, Walk, Work, Carry and Talk clips are retained for both characters, along with Machine_Mix in the environment. Gameplay XZ anchors and ground height are unchanged. Assets are self-contained GLBs with original materials; no external textures, paid APIs or new dependencies.

Run `node scripts/validate-bakery-assets.mjs` to check file hashes, embedded resources, rigs and animation names and report exact triangle/material counts. `npm test` includes the economy, story, route, pose-orientation and camera-framing regressions. `npm run build` checks strict TypeScript and production output.

Actual CPU-rendered Blender/glTF comparisons and pose checks informed the refinement. They are model evidence, not browser UI screenshots. Cloud Chromium previously reported WebGL disabled; actual phone rendering, animation contact and performance remain separate acceptance checks. No restriction was bypassed, and no frame-rate claim is made.

## Final measured runtime model sizes

| GLB | Previous triangles | Refined triangles | Previous bytes | Refined bytes |
|---|---:|---:|---:|---:|
| 阿禾 | 94,150 | 29,104 | 3,316,236 | 1,176,344 |
| 小满 | 109,108 | 38,364 | 3,830,408 | 1,487,412 |
| Bakery environment | 160,616 | 169,475 | 6,551,652 | 5,242,692 |
| Carry basket | 3,276 | 3,276 | 138,000 | 138,000 |
| Total loaded GLBs | 367,150 | 240,219 | 13,836,296 | 8,044,448 |

Character triangles fall about67%; all loaded GLB bytes fall about42%. These are file/geometry measures, not measured phone FPS. Previous asset URLs retained for old tabs are not part of the new app's loaded set.

Final verification:42 automated tests passed; asset-contract validator passed; strict TypeScript and Vite build passed. Actual exported-model Work, Carry and both Walk extrema were inspected in CPU renders; the final 小满 walking-apron correction is included. Runtime-manifest.json contains the exact integrated hashes.
