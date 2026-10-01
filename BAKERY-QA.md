# Bakery verification — v5 story-flow record

The v6 model/presentation refinement is documented in [BAKERY-REFINEMENT.md](BAKERY-REFINEMENT.md), with current Mac checks in [VERIFICATION.md](VERIFICATION.md). The following preserves the earlier story-flow evidence; actual WebGL acceptance remains separate.

## Passed

- 39 automated tests covering the bakery and preserved town models. The bakery tests enumerate all 2,592 legal complete plan paths and verify integer cash reconciliation, worker-hours, consent, capped demand, idempotent confirmation, strict save decoding, and deterministic checkpoint replay.
- Strict TypeScript and Vite production build.
- Original GLB assets exported and reimported in Blender; actual environment and character portraits visually inspected. These are asset checks, not browser rendering acceptance.
- Independent read-only interaction review. Fixed a stale asynchronous import race, unequal-horizon comparison, missing keyboard character details, premature animation phase transitions, and idle machine mixing.
- Actual cloud-browser UI flow on public version 4: intro, meet characters, four two-person decisions through day 7, undo, truthful forecast, repeated confirmation, page reload at day 2, accessible character details, consent-disabled choices, day-7 wage acknowledgment, full ledger and fixed-checkpoint replay.
- Observed route: Ahe personal/Xiaoman delivery (days1–2); Ahe study/Xiaoman extra (3–4); Ahe delivery/Xiaoman study (5–6); Ahe personal/Xiaoman extra with hourly agreement(day7). Outcome: 14 personal hours, 24 deliveries,32 extra loaves, cash¥1,282.40; wages Ahe¥520/Xiaoman¥560.
- Rewound to identical day-7 checkpoint, retained same activities and protected wages. Outcome: cash¥1,242.40; Ahe income¥560; time and output unchanged. UI comparison correctly displayed0h and−¥40.

## Explicit limits

The current cloud Chromium reports GL_VENDOR=Disabled and GL_RENDERER=Disabled and cannot create a WebGL context. Story controls and fallback UI work, but actual 3D character movement, camera framing, shadow quality, asset loading latency and phone frame rate are NOT browser-verified. No WebGL restrictions were bypassed. A fresh Mac tool probe by the parent also found no supported browser/CUA tool group. Phone visual/performance acceptance remains the user's inspection gate.

Version5 contains only the resulting presentation refinements: visible fallback notice, sticky tray actions and explicit forecast time/output quantities. No model-rule changes. Source publication and native successful deployment are verified separately.
