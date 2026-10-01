# Seven-day challenge

The default game starts with two actions per day, treasury ¥40, two food firms with ¥8 each and separate resident accounts. Over seven days, reach 100 meals, 40 shifts and retain at least ¥4. These are puzzle conditions, not real-policy evidence.

Targeted aid transfers ¥1.80 to a selected resident. Hiring support invests ¥6: the selected firm receives it, or the council selects the lower-cash firm. Automation invests ¥10 across firms and raises productivity by 0.5×. Daily support targets ¥0.70 per resident until paused, constrained by treasury cash. Non-aid actions cannot repeat within a day. Hiring remains demand-led; increased productivity can reduce labor demand.

Settlement computes one deterministic day then plays a 4.5-second illustrative replay along explicit routes to actual employers, selling firms and homes. v3 fills the viewport, focuses the camera on selected residents/buildings and shows contextual actions. Lists, goals, help and ledger appear in dismissible dialogs.

Challenge progress, reports and remaining actions persist separately from sandbox saves. Daily missed-meal names come from the food ledger, rather than cumulative hunger; loading old challenge reports repairs the names. Same-seed retry resets to identical initial conditions.

26 automated tests passed on Mac, including conserved money/food, roles and budgets, action limits, persistence, same-seed retry, terminal guards, atomic failures, daily meal reconciliation, selected-firm funding and navigation collision checks. Actual browser/mobile and enjoyment checks remain pending.
