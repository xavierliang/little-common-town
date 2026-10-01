import test from "node:test";
import assert from "node:assert/strict";
import { anchors, bakeryRoute, type BakeryPlace } from "./bakery-scene-routes";
test("bakery action routes reach all anchors without crossing kneading table", () => {
  for (const from of Object.values(anchors))
    for (const place of Object.keys(anchors) as BakeryPlace[]) {
      const points = [from, ...bakeryRoute(from, place)];
      assert.deepEqual(points.at(-1), anchors[place]);
      for (let i = 1; i < points.length; i++)
        for (let t = 0; t <= 1; t += 0.025) {
          const x = points[i - 1][0] + (points[i][0] - points[i - 1][0]) * t;
          const z = points[i - 1][2] + (points[i][2] - points[i - 1][2]) * t;
          assert.ok(
            !(x > -2.4 && x < -0.6 && z > -1.03 && z < -0.08),
            `${place}: crossed table`,
          );
        }
    }
});
