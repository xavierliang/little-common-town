# 面包出炉以后

The default entry is now a seven-day bakery story with four decisions (days 1–2, 3–4, 5–6, and 7). The former town challenge and economic sandbox remain under the menu, with their original saves intact.

## Play

Meet 阿禾 and 小满, select a person, then allocate their two-hour block. Desktop drag-and-drop is optional; every action has an equivalent tap control. Each person's stated refusals are enforced. Preview the full round before confirming; undo changes before confirmation. Confirmation advances the deterministic model exactly once, then replays the actual assignment. Animation speed cannot affect the ledger.

The final page records personal time, deliveries, extra loaves, wages and bakery cash without a moral score. Checkpoint replay uses identical starting cash, demand and preferences; the previous result remains available as a comparison for the current session.

The seven-day scenario assumes an already-borrowed machine reduces the worker-hours needed for 60 daily base loaves from eight to four. Each person works two base hours and decides how to use two freed hours. Protected wages remain ¥80 per person/day. Only on day 7 can both workers explicitly consent to the alternative hourly agreement. Machine running cost, ingredients, delivery costs, wages and finite demand are included. Machine acquisition, rent, tax and long-term investment are excluded and disclosed in the in-game assumptions. This small fictional model does not establish real-world policy superiority.

## Technical verification

- `npm ci` then `npm test` and `npm run build`
- 39 tests, including exhaustive accounting/time/consent checks across all 2,592 legal complete story paths
- Save files contain only validated plan histories, not editable balances; loading replays the same deterministic settlements
- Repeated confirmation is idempotent; a stale different plan is rejected
- Scene route tests prevent crossing the kneading table
- Real GLBs are original assets with no external textures; two character instances, capped device pixel ratio, 1024 shadow map
- Real Blender export/reimport and visual asset inspection completed
- Actual browser/mobile WebGL and performance verification must be reported separately; passing model tests and Blender renders do not constitute browser UI acceptance

Run locally with `npm run dev`. Production is a static Vite build in `dist`. No backend, paid API, account, or per-character LLM call is required. Story progress is stored separately in localStorage under `little-common-bakery-v1`. Export/import is available in the menu. Sound starts off and can only be enabled by a user gesture; it consists of quiet original synthesized notes.
