# Verification — bakery v5

Source commit: `a779f9d3d921c9107a5817657c3b8fb113933c64`, Site version 5. The supplied archive SHA256 is `0d201b84e555ba847e7166c489730dabe6a15a78d6cd3c9e9e78ce149448824c`; all 58 manifest file hashes were verified on Mac. The 42 executable source/test/model/portrait/configuration files in this checkout match the candidate. Public running/verification docs and ignore rules are maintained separately; old run logs and hosting/runtime metadata are excluded.

## Passed on Mac

- `npm test`: 39 passed, 0 failed, 0 skipped. The bakery tests enumerate all 2,592 legal complete story paths and verify time, consent, capped demand and integer cash reconciliation.
- Tests cover idempotent confirmation, strict save decoding, deterministic checkpoint replay, scene routes and preserved town-model regressions.
- `npm run build`: strict TypeScript and Vite production bundling passed on Node 22.19.0.
- Dependency lockfile unchanged from the prior verified installation.

## Browser acceptance

The canonical cloud flow and its exact limits are recorded in [BAKERY-QA.md](BAKERY-QA.md). This local synchronization does not claim new UI tests or screenshots. Actual WebGL character movement, camera framing, shadows, loading latency and mobile frame rate remain unverified here. Automated model tests and Blender renders do not establish browser visual success. Phone acceptance remains a separate inspection gate.

The Three.js chunk remains above Vite's 500 kB advisory threshold; no build errors occurred.
