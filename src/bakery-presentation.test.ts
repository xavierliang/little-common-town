import test from "node:test";
import assert from "node:assert/strict";
import { actorFacing, cameraFrame } from "./bakery-presentation";
test("greetings and completed work reveal faces; active workstation tasks face their tools", () => {
  assert.equal(actorFacing("counter", false), 0);
  for (const place of ["knead", "oven", "machine", "study"] as const) {
    assert.equal(actorFacing(place, true), Math.PI);
    assert.equal(actorFacing(place, false), 0);
  }
  assert.equal(actorFacing("delivery", true), 0);
  assert.equal(actorFacing("rest", true), 0);
});
test("focused framing makes a person readable and overview accommodates the projected diorama", () => {
  const beat = { ahe: "counter", xiaoman: "counter", active: false } as const;
  const f = cameraFrame("ahe", beat);
  const projectedHeight =
    1.6 *
    Math.cos(Math.atan2(13, Math.hypot(11, 16))) *
    Math.min(390 / f.horizontalSpan, 580 / f.verticalSpan);
  assert.ok(projectedHeight >= 80 && projectedHeight <= 100);
  const wide = cameraFrame("wide", beat);
  assert.ok(
    wide.horizontalSpan >
      (12 * 16) / Math.hypot(11, 16) + (10 * 11) / Math.hypot(11, 16),
  );
  const action = cameraFrame("auto", {
    ahe: "knead",
    xiaoman: "oven",
    active: true,
  });
  assert.ok(action.horizontalSpan < wide.horizontalSpan);
  assert.equal(
    cameraFrame("wide", { ahe: "knead", xiaoman: "oven", active: true })
      .horizontalSpan,
    wide.horizontalSpan,
  );
  assert.deepEqual(action.target, [-2.05, 0.8, -0.4]);
});
