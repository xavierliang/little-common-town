import test from "node:test";
import assert from "node:assert/strict";
import { newGame, act, nextDay, goals, encodeGame, decodeGame } from "./game";
import { applyCommand, validateState, metrics, serialize } from "./sim";
test("challenge starts paused-ready with explicit budget and separate endowments", () => {
  const g = newGame();
  assert.equal(g.town.day, 0);
  assert.equal(g.actionsLeft, 2);
  assert.equal(g.town.accounts.treasury.balanceCents, 4000);
  assert.deepEqual(validateState(g.town), []);
});
test("actions cost real conserved money and cannot exceed daily limit", () => {
  let g = newGame();
  const total = metrics(g.town).totalMoneyCents;
  g = act(g, "aid", "r3");
  assert.equal(g.town.accounts.treasury.balanceCents, 3820);
  g = act(g, "jobs");
  assert.equal(g.town.accounts.treasury.balanceCents, 3220);
  assert.throws(() => act(g, "automation"));
  assert.equal(metrics(g.town).totalMoneyCents, total);
  assert.deepEqual(validateState(g.town), []);
  assert.equal(nextDay(g).actionsLeft, 2);
});
test("repeated investment click rejected, automation uses 1000 cents and roles enforced", () => {
  const g = act(newGame(), "automation");
  assert.equal(g.town.accounts.treasury.balanceCents, 3000);
  assert.equal(g.town.policy.aiProductivity, 1.5);
  assert.throws(() => act(g, "automation"));
  for (const type of ["observer", "resident"] as const)
    assert.throws(() =>
      applyCommand(
        g.town,
        { type: "investAutomation" },
        type === "resident" ? { type, residentId: "r1" } : { type },
      ),
    );
  assert.deepEqual(validateState(g.town), []);
});
test("failed spending remains atomic and cannot overdraw", () => {
  let town = newGame().town;
  while (town.accounts.treasury.balanceCents >= 180)
    town = applyCommand(
      town,
      { type: "grantAid", residentId: "r1" },
      { type: "mayor" },
    );
  const before = serialize(town);
  assert.throws(() =>
    applyCommand(town, { type: "investAutomation" }, { type: "mayor" }),
  );
  assert.equal(serialize(town), before);
  assert.deepEqual(validateState(town), []);
});
test("refresh retains limited actions, day and ledger exactly", () => {
  let g = act(newGame(), "aid", "r2");
  const loaded = decodeGame(encodeGame(g));
  assert.deepEqual(loaded, g);
  assert.equal(loaded.actionsLeft, 1);
  g = act(loaded, "sharing");
  assert.throws(() => act(decodeGame(encodeGame(g)), "jobs"));
  assert.deepEqual(decodeGame(encodeGame(nextDay(g))), nextDay(g));
  const broken = JSON.parse(encodeGame(g));
  broken.game.actionsLeft = 2;
  assert.throws(() => decodeGame(JSON.stringify(broken)));
});
test("seven day puzzle has win and fail strategies, equal-seed replay and terminal guard", () => {
  let idle = newGame(),
    mixed = act(newGame(), "sharing"),
    perpetual = act(newGame(), "sharing");
  for (let d = 0; d < 7; d++) {
    idle = nextDay(idle);
    if (d === 3) mixed = act(mixed, "reserve");
    mixed = nextDay(mixed);
    perpetual = nextDay(perpetual);
  }
  assert.equal(goals(idle).food, false);
  assert.equal(goals(perpetual).reserve, false);
  assert.deepEqual(goals(mixed), { food: true, work: true, reserve: true });
  assert.throws(() => nextDay(mixed));
  assert.throws(() => act(mixed, "aid", "r1"));
  assert.deepEqual(validateState(mixed.town), []);
  let replay = act(newGame(), "sharing");
  for (let d = 0; d < 7; d++) {
    if (d === 3) replay = act(replay, "reserve");
    replay = nextDay(replay);
  }
  assert.equal(serialize(replay.town), serialize(mixed.town));
});
