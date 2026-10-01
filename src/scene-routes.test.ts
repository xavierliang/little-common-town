import test from "node:test";
import assert from "node:assert/strict";
import layout from "./town-layout.json";
import {
  routeBetween,
  pointOnRoute,
  residentHome,
  type Point,
} from "./scene-routes";
test("resident routes stay finite, begin/end at anchors and avoid building footprints", () => {
  for (let i = 0; i < 16; i++) {
    const home = residentHome(i);
    for (const work of Object.values(layout.workAnchors)) {
      for (const [from, to] of [
        [home, work],
        [work, home],
      ]) {
        const route = routeBetween(from as Point, to as Point);
        assert.deepEqual(pointOnRoute(route, 0), from);
        assert.deepEqual(
          pointOnRoute(route, 1).map((n) => +n.toFixed(5)),
          to.map((n) => +n.toFixed(5)),
        );
        for (let t = 0; t <= 100; t++) {
          const p = pointOnRoute(route, t / 100);
          assert.ok(p.every(Number.isFinite));
          assert.ok(Math.hypot(p[0] + 1.2, p[2] + 1) > 1.35, "tree planter");
          for (const b of layout.buildingHotspots) {
            const inside =
              Math.abs(p[0] - b.center[0]) < b.size[0] / 2 - 0.05 &&
              Math.abs(p[2] - b.center[2]) < b.size[2] / 2 - 0.05;
            assert.equal(
              inside,
              false,
              `resident ${i} intersects ${b.id} at ${p}`,
            );
          }
        }
      }
    }
  }
});
