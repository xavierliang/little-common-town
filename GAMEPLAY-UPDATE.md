# Seven-day challenge update

The default entry is now a small turn-based game rather than the observer dashboard. It starts paused, with two actions/day and explicit scenario targets: 100 meals, 40 worked shifts over seven days, and at least ¥4 treasury reserve at the end. These are deliberately chosen puzzle conditions, not evidence of any real policy's superiority.

Challenge endowments differ from sandbox: treasury ¥40; each firm ¥8; resident cash ¥1–2.50. The original sandbox and its existing browser save key are retained separately. Challenge progress and remaining actions persist in a new browser-local save, validated before use.

Actions use the same validated economic command boundary:
- Targeted aid: treasury pays ¥1.80 to the selected resident
- Hiring support: treasury invests ¥6 in the lower-cash food firm; hiring remains demand-led, not guaranteed
- Automation: treasury invests ¥10 across both firms, raising productivity by 0.5×; may reduce demand for labor
- Daily support: enable ¥0.70/person/day or stop it; available treasury cash limits payouts

Each action costs one of two daily decisions. Investment and policy actions cannot repeat in the same day; aid can be targeted twice. Investment funds increase retained working capital instead of being immediately distributed as dividends. Money is neither created nor destroyed.

Settlement computes one deterministic economic day then plays a 4.5-second illustrative replay. Employed residents move toward their actual firm, residents with a purchase in that day's ledger move to the selling firm, then return home. This is explicitly a replay of day outcomes, not continuous simulation. All-roaming decorative loops and most labels were removed. Only the selected resident and the two firms retain names on the map.

Mobile map height is reduced, decision cards are explicit and the settlement bar remains reachable at the safe-area bottom. Resident chips prioritize hunger/low cash. Settlement and actions have synchronous guards against rapid duplicate input. A result appears each day and a final result allows equal-seed retry or sandbox entry.

Validation: 22 engine/game tests, including scenario balance, budget/role limits, action counts across reload, equal-seed replay, terminal state, failed spend atomicity, and distinct win/fail strategy outcomes. Existing 300-day tests still pass. This is not a browser visual/interaction QA claim.
