# Verification — refined bakery v6

Canonical Site source: `8ff89ae252824ec95c311f1d6a4609106d2fe5e5`, based on v5 `a779f9d3d921c9107a5817657c3b8fb113933c64`. Archive SHA256 `c6f18131d5feba7292c49171e5ca23bd61f280f4ee682e77e2ea61b3a15b1b20` and all 70 manifest hashes were verified on Mac. The 53 code/test/script/model/portrait/configuration files match the candidate; public running/verification docs and ignore rules are maintained separately. GitHub keeps independent Git history.

## Passed on Mac

- `npm test`: 42 passed, 0 failed, 0 skipped; the complete 2,592 legal story paths remain checked.
- `node scripts/validate-bakery-assets.mjs`: passed hashes, embedded resources, 18-bone character rigs, exact Idle/Walk/Work/Carry/Talk clips and environment Machine_Mix.
- Presentation tests cover actor-facing and camera-projection calculations; route tests still pass.
- `npm run build`: strict TypeScript and Vite production bundling passed on Node 22.19.0.
- Bakery economy source and dependency lockfile are byte-identical to v5.

The runtime manifest selects the refined content-hashed assets. Prior unversioned v5 assets remain for compatibility and are outside the new app's loaded set. Measured loaded GLBs total 8,044,448 bytes and 240,219 triangles; these are file/geometry data, not a frame-rate measurement. See [BAKERY-REFINEMENT.md](BAKERY-REFINEMENT.md).

## Pending visual acceptance

No supported browser/Computer Use tools were exposed in this local review, so no new browser screenshots are claimed. Real close-up appearance, walking-apron penetration, hand/worktop contact, mobile safe-area layout, loading and GPU performance remain unverified here. CPU-rendered model evidence, asset checks and projection calculations do not replace actual WebGL acceptance.

The Three.js bundle remains above Vite's 500 kB advisory threshold; build completed successfully. Earlier story-flow observations are preserved in [BAKERY-QA.md](BAKERY-QA.md).
