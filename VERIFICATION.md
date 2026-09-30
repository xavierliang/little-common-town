# Verification

Run `npm test` for 22 deterministic economic-engine and challenge tests, and `npm run build` for TypeScript and production bundling. Tests cover money conservation, validated commands, budget and role limits, action counts across reload, equal-seed retry, terminal state, failed spend atomicity, and distinct winning/losing strategies.

Automated tests do not establish WebGL rendering quality, mobile usability or enjoyment. Use [PREVIEW-CHECKLIST.md](PREVIEW-CHECKLIST.md) for browser checks. Model geometry, animation clips and dimensions are listed in `public/models/manifest.json`.

The public source import originates from commit `155d0f7d6a17eb41c59fee035db125988549b554`; executable source, models, tests and lockfile were verified against the source archive before import.
