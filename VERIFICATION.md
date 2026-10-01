# Verification — bakery v7 lower-face correction

Canonical Site source: `f3e4704278d0adfb199fb27455279f266fbda1a1`, based on v6 `8ff89ae252824ec95c311f1d6a4609106d2fe5e5`. The 11,070,160-byte source archive has SHA256 `60c927c4b504d759e59f67052edb45f10c4823901620c5aa94e3b9319525f835`; all 75 manifest hashes were verified on Mac. The 57 code/test/script/model/portrait/configuration files match the final candidate. Public running/verification docs and ignore rules are maintained separately. GitHub keeps independent Git history.

## Passed on Mac

- `npm test`: 42 passed, 0 failed, 0 skipped; the complete 2,592 legal story paths remain checked.
- `node scripts/validate-bakery-assets.mjs`: passed runtime hashes, embedded resources, exact five character clips, 18-bone rigs and environment Machine_Mix.
- A separate v6-to-v7 GLB comparison verified unchanged bone names/transforms and inverse-bind matrices, and byte-identical time/value curves for all 270 channels in each character's five clips (Idle, Walk, Work, Carry, Talk).
- All vertex weights are normalized. Coordinates and weights are byte-identical for the 9,247 阿禾 and 10,065 小满 vertices without head/neck influences. Face/neck topology intentionally changes; the canonical model review separately covered surviving non-face/non-neck geometry.
- `npm run build`: strict TypeScript and Vite production bundling passed on Node 22.19.0.
- Beyond the four final character/portrait assets, only the runtime manifest and asset-reference module changed. Gameplay, environment, basket, camera, saves, tests and the dependency lockfile remain byte-identical to v6.

The final runtime revision is `chin-contour-v3-2026-10-01`. It selects the reviewed final correction; the earlier rejected chin candidate is not integrated. Previous published asset URLs remain for already-open tabs. Current 阿禾/小满 GLBs contain 30,650/37,244 triangles and 1,229,996/1,456,772 bytes. These are file/geometry data, not frame-rate measurements. See [BAKERY-CHIN-FIX.md](BAKERY-CHIN-FIX.md).

## Separate visual acceptance

The canonical owner reviewed Blender front/side/three-quarter solid and color renders. No new local browser screenshots or phone/GPU performance claims are made. Real WebGL appearance, animation contact, mobile safe-area layout and performance require separate acceptance.

The Three.js bundle remains above Vite's 500 kB advisory threshold; build completed successfully. Earlier story-flow observations are preserved in [BAKERY-QA.md](BAKERY-QA.md).
