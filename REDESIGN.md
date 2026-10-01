# Full-viewport town redesign (v3)

Historical town presentation retained under the v6 bakery menu. See [BAKERY.md](BAKERY.md) for the current default entry.

This iteration preserves the seven-day economy and adds a game-first visual/interaction shell. The town occupies the viewport (100dvh), without forcing the browser Fullscreen API. A compact HUD holds day, meal/shift progress and public budget. Resident/building selection focuses the camera and opens relevant actions in a bottom context tray. The map stays visible; roster, goals, help and ledger use dismissible dialogs.

The original concept's human-scale clay direction is carried into a new efficient scene: four compact duplex homes, bakery, workshop, rear civic landmark, paved social square, gardens, produce market, river, bridge, dock/boat and layered greenery. Resident height is approximately 1.64 scene units; homes are roughly 3.8 high. Original animated resident/robot assets are retained, with muted clothing variants. Environment: about 67k triangles, 25 material-batched meshes, no textures. The environment preview is a Blender render, not proof of browser rendering.

Residents follow explicit navigation paths between home, actual employer and the shop named in that day's purchase ledger. Routes avoid building footprints and the central planter. During a daily replay, simulated accounting has already settled; animation illustrates those outcomes.

Regression fixes:
- World/labels have their own lower stacking context; labels hide when a dialog opens
- Daily missed-meal names are reconstructed from individual food purchases/consumption, rather than cumulative hunger. Old persisted challenge reports are repaired on load
- Reload guidance shows the actual remaining action count
- Selecting a firm can fund that specific firm's working capital using the same validated command and one daily action

Verification: strict TypeScript and production build passed; 26 tests passed, including food/currency invariants, persistence, limited actions, named daily meal reconciliation and navigation collision checks. Actual revised browser visuals, mobile framing, selection, dialog layering and controls still require the requested Mac screenshot/playtest before final acceptance. The specified candidate corresponds to the reported published Site commit 71aa37b08a4a4140c34825d00282bbccff16845c. Mac tests/build passed; actual v3 browser QA remains pending.
