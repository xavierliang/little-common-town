import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accounting,
  advance,
  decodeExperiment,
  defaultLayout,
  directionalCell,
  encodeExperiment,
  facilityDistance,
  initialExperiment,
  load,
  moveFacility,
  observe,
  route,
  rules,
  bottleneck,
  seconds,
  validate,
  type Experiment,
  type Layout,
} from "./experiment-engine";
const running = (layout?: Layout) => ({
  ...initialExperiment(layout),
  paused: false,
});
function run(s: Experiment, duration: number) {
  for (let t = 0; t < duration; t += 0.25) {
    s = advance(s, 0.25);
    validate(s);
  }
  return s;
}
function atOven() {
  const s = running();
  s.stocks.store.grain = 20;
  s.stocks.oven.grain = 4;
  s.workers[0].position = [6, 1];
  s.workers[1].position = [7, 2];
  return s;
}
test("complete physical loop conserves all materials and finite energy at every quarter second", () => {
  const s = run(running(), 180),
    a = accounting(s);
  assert.ok(s.produced > 0);
  assert.ok(s.workers.every((w) => w.meals > 0));
  assert.equal(a.total, 24);
  assert.equal(a.energy + a.energyUsed, rules.initialEnergy);
  assert.ok(
    s.workers.every(
      (w) => w.walked > 0 && w.workSeconds > 0 && w.eatingSeconds > 0,
    ),
  );
  assert.ok(s.stocks.store.grain < 24);
});
test("two simultaneous pickups reserve limited loads without inventing goods", () => {
  const s = running();
  s.workers[0].position = [1, 2];
  s.workers[1].position = [2, 1];
  const n = advance(s, 0.25);
  assert.equal(n.stocks.store.grain, 20);
  assert.equal(n.workers[0].cargo.grain, 0);
  assert.equal(accounting(n).held, 4);
  assert.equal(accounting(n).total, 24);
  assert.ok(n.workers.every((w) => load(w) <= 2));
  validate(n);
  const complete = advance(n, 0.75);
  assert.ok(complete.workers.every((w) => w.cargo.grain === 2));
  assert.equal(complete.stocks.oven.grain, 0);
});
test("processing reserves input, consumes energy once and cannot finish before six seconds", () => {
  let s = atOven();
  s = advance(s, 0.25);
  assert.equal(s.energy, rules.initialEnergy - 2);
  assert.equal(s.stocks.oven.grain, 2);
  assert.equal(s.batch?.owner, "ahe");
  assert.equal(s.produced, 0);
  s = advance(s, 5.5);
  assert.equal(s.produced, 0);
  assert.equal(s.energy, rules.initialEnergy - 2);
  assert.equal(accounting(s).inProcess, 2);
  s = advance(s, 0.25);
  assert.equal(s.produced, 2);
  assert.equal(s.batch, null);
  assert.equal(s.stocks.oven.bread, 2);
  validate(s);
});
test("blocked paths and finite capacity change travel; moving facilities changes measured causal outcomes", () => {
  const path = route(defaultLayout, [1, 2], "oven")!;
  assert.ok(path.length > 6);
  assert.ok(path.every((p) => !(p[0] === 4 && p[1] >= 1 && p[1] <= 5)));
  const close: Layout = { store: [6, 3], oven: [7, 3], table: [7, 5] };
  assert.ok(
    facilityDistance(close, "store", "oven")! <
      facilityDistance(defaultLayout, "store", "oven")!,
  );
  const far = run(running(), 120),
    near = run(running(close), 120);
  assert.ok(
    near.produced > far.produced,
    `near ${near.produced}; far ${far.produced}`,
  );
  assert.ok(
    near.workers.reduce((n, w) => n + w.meals, 0) >=
      far.workers.reduce((n, w) => n + w.meals, 0),
  );
});
test("hungry workers prefer reachable food; not-hungry workers leave it in place", () => {
  const s = running();
  s.stocks.store.grain = 22;
  s.stocks.table.bread = 2;
  s.produced = 2;
  s.energy = rules.initialEnergy - 2;
  s.energyUsed = 2;
  s.workers[0].hunger = 70;
  s.workers[0].position = [6, 5];
  s.workers[1].hunger = 20;
  const n = advance(s, 0.25);
  assert.equal(n.workers[0].task?.kind, "eat");
  assert.equal(n.workers[0].task?.reserved.bread, 1);
  assert.notEqual(n.workers[1].task?.kind, "eat");
  assert.equal(accounting(n).total, 24);
  const ate = advance(n, 1.75);
  assert.equal(ate.workers[0].meals, 1);
  assert.ok(ate.workers[0].hunger < 30);
  validate(ate);
});
test("moving the oven mid-batch preserves input and elapsed work; must reach new oven to continue", () => {
  let s = advance(atOven(), 2);
  assert.ok(s.batch);
  const remaining = s.workers[0].task!.remaining;
  s = moveFacility(s, "oven", [8, 6]);
  assert.equal(s.paused, true);
  assert.equal(accounting(s).total, 24);
  assert.equal(s.energy, rules.initialEnergy - 2);
  const travel = advance({ ...s, paused: false }, 0.25);
  assert.equal(travel.workers[0].task!.remaining, remaining);
  assert.equal(travel.produced, 0);
  const complete = run({ ...s, paused: false }, 30);
  assert.ok(complete.produced >= 2);
  assert.equal(accounting(complete).total, 24);
});
test("moving a warehouse during pickup preserves reserved cargo and re-targets the operation", () => {
  let s = running();
  s.workers[0].position = [1, 2];
  s = advance(s, 0.25);
  assert.equal(s.workers[0].task?.reserved.grain, 2);
  s = moveFacility(s, "store", [0, 6]);
  validate(s);
  assert.equal(accounting(s).total, 24);
  const n = advance({ ...s, paused: false }, 0.25);
  assert.equal(n.workers[0].task!.remaining, 0.75);
  assert.ok(n.workers[0].next);
  const after = run({ ...s, paused: false }, 60);
  assert.ok(after.produced > 0);
  assert.equal(accounting(after).total, 24);
});
test("closed corridor is an observable wait, not teleportation or disappearing inventory", () => {
  const layout: Layout = { store: [4, 0], oven: [4, 6], table: [8, 6] };
  const s = running(layout);
  s.workers[0].position = [0, 2];
  s.workers[1].position = [0, 3];
  assert.equal(route(layout, [0, 2], "table"), null);
  const n = run(s, 20);
  assert.equal(accounting(n).total, 24);
  assert.ok(n.workers.every((w) => w.position[0] < 4));
});
test("pause, deterministic batching, step and same-layout reset preserve isolated simulation semantics", () => {
  const initial = initialExperiment();
  assert.equal(advance(initial, 10), initial);
  const one = advance({ ...initial, paused: false }, 10);
  let many = { ...initial, paused: false };
  for (let i = 0; i < 40; i++) many = advance(many, 0.25);
  assert.deepEqual(one, many);
  const stepped = observe(initial, 10);
  assert.equal(stepped.paused, true);
  assert.equal(seconds(stepped), 10);
  assert.deepEqual(initialExperiment(stepped.layout), initial);
  assert.throws(() => observe(one));
  assert.throws(() => advance(initial, NaN));
});
test("valid saves survive mid-route, pickup, batch and meal; forged bread, energy and paths fail", () => {
  let s = running();
  for (let i = 0; i < 500; i++) {
    s = advance(s, 0.25);
    assert.deepEqual(decodeExperiment(encodeExperiment(s)), s);
  }
  const fake = initialExperiment();
  fake.stocks.store.grain = 23;
  fake.stocks.table.bread = 1;
  assert.throws(() => decodeExperiment(JSON.stringify(fake)));
  const energy = initialExperiment();
  energy.energy = 25;
  assert.throws(() => validate(energy));
  const wall = initialExperiment();
  wall.workers[0].position = [4, 0.8];
  wall.workers[0].next = [4, 0];
  assert.throws(() => validate(wall));
  const version = JSON.stringify({ ...initialExperiment(), version: 9 });
  assert.throws(() => decodeExperiment(version));
});
test("touch cell placement and keyboard directions use the same constraints, with no resource changes", () => {
  let s = initialExperiment();
  const before = accounting(s);
  const destination = directionalCell(s.layout.store, "right");
  s = moveFacility(s, "store", destination);
  assert.deepEqual(s.layout.store, [2, 1]);
  assert.deepEqual(accounting(s), before);
  assert.equal(s.tick, 0);
  assert.throws(() => moveFacility(s, "store", [4, 2]));
  assert.throws(() => moveFacility(s, "store", s.layout.oven));
  assert.throws(() => moveFacility(s, "store", [-1, 1]));
  assert.throws(() => moveFacility(s, "store", s.workers[0].position));
  for (const direction of ["down", "right", "up", "left"] as const)
    s = moveFacility(s, "store", directionalCell(s.layout.store, direction));
  assert.deepEqual(s.layout.store, destination);
  assert.deepEqual(accounting(s), before);
  validate(s);
});
test("no energy can be transformed into food when the oven budget is exhausted", () => {
  const s = run(running({ store: [6, 3], oven: [7, 3], table: [7, 5] }), 500);
  assert.equal(s.energy, 0);
  assert.equal(s.energyUsed, rules.initialEnergy);
  assert.equal(s.produced, 16);
  const later = run(s, 60);
  assert.equal(later.produced, 16);
  assert.equal(accounting(later).total, 24);
});

test("waypoint crossings keep fractional movement time, matching advertised empty and loaded speeds", () => {
  const empty = advance(running(), 2);
  assert.ok(Math.abs(empty.workers[0].walked - 2.4) < 1e-8);
  assert.ok(Math.abs(empty.workers[0].walkingSeconds - 2) < 1e-8);
  let s = running();
  s.workers[0].position = [1, 2];
  s = advance(s, 1);
  assert.equal(s.workers[0].cargo.grain, 2);
  const before = s.workers[0].walked,
    n = advance(s, 2);
  assert.ok(Math.abs(n.workers[0].walked - before - 1.6) < 1e-8);
  validate(n);
});
test("reopening a corridor clears both the decision and current bottleneck explanation", () => {
  let s = running({ store: [4, 0], oven: [4, 6], table: [8, 6] });
  s.stocks.store.grain = 22;
  s.produced = 2;
  s.energy = 14;
  s.energyUsed = 2;
  s.workers[0].position = [3, 6];
  s.workers[0].cargo.bread = 2;
  s.workers[1].position = [0, 2];
  s = advance(s, 0.25);
  assert.match(s.workers[0].reason, /通路被挡/);
  assert.match(bottleneck(s), /通路被挡/);
  s = moveFacility(s, "store", [0, 0]);
  s = advance({ ...s, paused: false }, 0.25);
  assert.ok(s.workers[0].next);
  assert.doesNotMatch(s.workers[0].reason, /通路被挡/);
  assert.doesNotMatch(bottleneck(s), /通路被挡/);
  validate(s);
});
test("a sealed supply route remains the bottleneck even when no worker can choose a task", () => {
  let s = run(running({ store: [4, 0], oven: [8, 1], table: [4, 6] }), 1);
  assert.ok(s.workers.every((w) => !w.task));
  assert.ok(s.workers.every((w) => w.reason.includes("通路被挡")));
  assert.match(bottleneck(s), /通路被挡/);
  assert.equal(s.produced, 0);
  assert.equal(accounting(s).total, 24);
  s = moveFacility(s, "table", [7, 5]);
  s = advance({ ...s, paused: false }, 0.25);
  assert.ok(s.workers.some((w) => w.task));
  assert.doesNotMatch(bottleneck(s), /通路被挡/);
  validate(s);
});
test("unstarted interactions cannot restore with shortened pickup, process or meal durations", () => {
  const pickup = advance(running(), 0.25);
  assert.equal(pickup.workers[0].task?.started, false);
  pickup.workers[0].task!.remaining = 0.25;
  assert.throws(() => decodeExperiment(JSON.stringify(pickup)));
  const base = atOven();
  base.workers[0].position = [5, 5];
  const process = advance(base, 0.25);
  assert.equal(process.workers[0].task?.kind, "process");
  assert.equal(process.workers[0].task?.started, false);
  process.workers[0].task!.remaining = 0.25;
  assert.throws(() => decodeExperiment(JSON.stringify(process)));
  const meal = running();
  meal.stocks.store.grain = 22;
  meal.stocks.table.bread = 2;
  meal.produced = 2;
  meal.energy = 14;
  meal.energyUsed = 2;
  meal.workers[0].hunger = 80;
  const pending = advance(meal, 0.25);
  assert.equal(pending.workers[0].task?.kind, "eat");
  assert.equal(pending.workers[0].task?.started, false);
  pending.workers[0].task!.remaining = 0.25;
  assert.throws(() => decodeExperiment(JSON.stringify(pending)));
});
