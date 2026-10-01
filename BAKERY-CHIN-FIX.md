# Focused lower-face correction

Both character GLBs and their UI portraits now use the visually reviewed v3 correction. The earlier v2 candidate was not published: front/three-quarter review found a crease below the lip. The final lower face uses a continuous rebuilt surface, a seated smile and recessed neck support, removing the protruding chin and the crease.

Only these four runtime assets and their content-hashed references changed. Environment, basket, gameplay, camera, saves and accounting are unchanged. Previous asset URLs remain available for already-open tabs; the previous published version remains a rollback point.

The face topology intentionally changed. Non-face/non-neck vertex coordinates and weights were checked by the independent model review and preserved. Integration independently verifies18-bone names, normalized weights and byte-identical curves for all five clips (Idle, Walk, Work, Carry, Talk). Asset hashes/embedded resources,42 automated game/presentation tests and the strict production build pass. Current file hashes and sizes are in public/models/bakery/runtime-manifest.json.

Actual solid and color front/side/three-quarter model renders were inspected. These are Blender/model evidence, not browser screenshots or phone performance verification.
