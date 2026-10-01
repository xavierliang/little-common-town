# Verification

The specified v3 source candidate was verified on Mac: archive SHA256 `6b4bfd9392523f369bc39d7c91af63ed54e45b88ab8b08373325e0221d8b9cdf`; all 41 manifest file hashes matched. The 28 code/test/model/configuration files in this public checkout match that candidate. Public docs and ignore rules are maintained separately.

The canonical Site version is reported as commit `71aa37b08a4a4140c34825d00282bbccff16845c`; this repository has independent Git history.

## Passed on Mac

- `npm test`: 26 passed, 0 failed, 0 skipped.
- `npm run build`: TypeScript and Vite production build succeeded on Node 22.19.0.
- Daily missed-meal names reconcile with daily unmet meals, including the previously observed mixed-policy day-six scenario.
- Reload guidance correctly reflects 2, 1 and 0 remaining actions.
- Selected-firm funding reaches that firm and consumes one action.
- Deterministic engine review reproduced 101 meals, 43 shifts and ¥29.37 reserve using two policy actions in seven days.

The dependency lockfile is unchanged from the prior verified installation. Tests and build do not establish browser correctness or enjoyment.

## Pending browser gate

Actual v3 WebGL visuals, resident/building proportions, camera focus, animation, modal labels, desktop/mobile geometry, safe-area controls, browser reload and sandbox navigation still require real browser checks. Existing v2 screenshots describe the previous layout. See [PREVIEW-CHECKLIST.md](PREVIEW-CHECKLIST.md).

The two-action winning strategy means late-game repetition remains a concern. The Three.js bundle exceeds Vite's 500 kB advisory threshold; actual loading/GPU/mobile performance needs profiling.
