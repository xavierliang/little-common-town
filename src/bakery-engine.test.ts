import test from "node:test";
import assert from "node:assert/strict";
import {
  initialStory,
  getRound,
  previewPlan,
  confirmPlan,
  availableChoices,
  availableWageModes,
  defaultPlan,
  encodeStory,
  decodeStory,
  replayCheckpoint,
  report,
  constants,
  rounds,
  type Plan,
  type StoryState,
  type Activity,
} from "./bakery-engine.ts";

const rest: Plan = {
  allocations: { ahe: "rest", xiaoman: "rest" },
  wageMode: "protected",
};
function through(count: number, plan: Plan = rest): StoryState {
  let state = initialStory();
  for (let i = 0; i < count; i++) state = confirmPlan(state, plan, i);
  return state;
}

test("four rounds settle exactly seven consecutive days", () => {
  const state = through(4);
  assert.deepEqual(
    rounds.map((round) => round.days.length),
    [2, 2, 2, 1],
  );
  assert.deepEqual(
    state.days.map((day) => day.day),
    [1, 2, 3, 4, 5, 6, 7],
  );
  assert.equal(state.completed, true);
  assert.equal(state.roundIndex, 4);
  assert.equal(getRound(state), null);
  assert.equal(state.cashCents, 106000);
  assert.throws(() => previewPlan(state, rest), /已完成/);
});

test("preview is pure, repeatable, isolated from caller draft, and never pays twice", () => {
  const initial = initialStory();
  const draft = structuredClone(rest);
  const before = encodeStory(initial);
  const preview = previewPlan(initial, draft);
  assert.deepEqual(preview, previewPlan(initial, draft));
  assert.equal(encodeStory(initial), before);
  assert.equal(initial.cashCents, 50000);
  assert.equal(initial.days.length, 0);
  assert.equal(preview.afterCashCents, 66000);
  draft.allocations.ahe = "extra";
  assert.equal(preview.plan.allocations.ahe, "rest");
  const next = confirmPlan(initial, rest, 0);
  assert.equal(confirmPlan(next, structuredClone(rest), 0), next);
  assert.throws(() => confirmPlan(next, draft, 0), /已结算/);
  assert.throws(() => confirmPlan(initial, rest, 1), /检查点已变化/);
  assert.equal(Object.isFrozen(next), true);
  assert.equal(Reflect.set(next, "cashCents", 900000), false);
  assert.equal(next.cashCents, 66000);
});

test("maintained wages are paid even for all personal time", () => {
  const state = through(4);
  const result = report(state);
  assert.equal(result.personalHours, 28);
  assert.equal(result.commercialHours, 0);
  assert.equal(result.characters.ahe.workedHours, 14);
  assert.equal(result.characters.ahe.paidHours, 28);
  assert.equal(result.characters.ahe.wagesCents, 56000);
  assert.equal(result.characters.xiaoman.wagesCents, 56000);
  assert.equal(result.characters.ahe.studyHours, 4);
  assert.equal(result.characters.xiaoman.studyHours, 4);
  assert.equal(result.baseLoaves, 420);
  assert.equal(result.extraLoaves, 0);
  assert.equal(result.deliveryStops, 0);
});

test("activity consent is per person and per round, preferences do not become orders", () => {
  const state = initialStory();
  const choices = availableChoices(state, "xiaoman");
  assert.equal(
    choices.find((choice) => choice.id === "extra")?.available,
    false,
  );
  assert.match(
    choices.find((choice) => choice.id === "extra")?.reason ?? "",
    /不接加单/,
  );
  assert.equal(choices.find((choice) => choice.id === "rest")?.available, true);
  assert.equal(
    choices.find((choice) => choice.id === "rest")?.preferred,
    false,
  );
  assert.doesNotThrow(() => previewPlan(state, rest));
  assert.throws(
    () =>
      previewPlan(state, {
        ...rest,
        allocations: { ahe: "rest", xiaoman: "extra" },
      }),
    /不接加单/,
  );
  assert.throws(
    () =>
      previewPlan(through(1), {
        ...rest,
        allocations: { ahe: "delivery", xiaoman: "rest" },
      }),
    /拒绝/,
  );
  assert.throws(
    () =>
      previewPlan(through(2), {
        ...rest,
        allocations: { ahe: "extra", xiaoman: "rest" },
      }),
    /不接额外/,
  );
  assert.throws(
    () =>
      previewPlan(through(2), {
        ...rest,
        allocations: { ahe: "rest", xiaoman: "delivery" },
      }),
    /拒绝/,
  );
  assert.equal(
    availableChoices(through(3), "ahe").every((choice) => choice.available),
    true,
  );
});

test("wage changes require explicit mutual consent and affect only actual work", () => {
  const hourlyRest: Plan = { ...rest, wageMode: "hourly" };
  for (let round = 0; round < 3; round++) {
    const state = through(round);
    assert.equal(
      availableWageModes(state).find((choice) => choice.id === "hourly")
        ?.available,
      false,
    );
    assert.throws(() => previewPlan(state, hourlyRest), /尚未共同同意/);
  }
  const day7 = through(3);
  assert.equal(
    availableWageModes(day7).find((choice) => choice.id === "hourly")
      ?.available,
    true,
  );
  assert.equal(getRound(day7)?.preferences.ahe.hourlyConsent, true);
  assert.equal(getRound(day7)?.preferences.xiaoman.hourlyConsent, true);
  const preview = previewPlan(day7, {
    allocations: { ahe: "rest", xiaoman: "extra" },
    wageMode: "hourly",
  });
  assert.equal(preview.characters.ahe.wagesCents, 4000);
  assert.equal(preview.characters.xiaoman.wagesCents, 8000);
  assert.match(preview.dialogue.ahe, /同意/);
  assert.equal(preview.deltaCents, 8000 + 4000 + 8 * 420);
  const baseline = previewPlan(day7, {
    allocations: { ahe: "rest", xiaoman: "extra" },
    wageMode: "protected",
  });
  assert.equal(preview.afterCashCents - baseline.afterCashCents, 4000);
});

test("delivery sells only a service on base bread, with finite daily demand and real costs", () => {
  const plan: Plan = {
    allocations: { ahe: "delivery", xiaoman: "delivery" },
    wageMode: "protected",
  };
  const preview = previewPlan(initialStory(), plan);
  assert.deepEqual(
    preview.days.map((day) => day.deliveryStops),
    [8, 10],
  );
  assert.deepEqual(
    preview.days.map((day) => day.baseLoaves),
    [60, 60],
  );
  assert.deepEqual(
    preview.days.map((day) => day.extraLoaves),
    [0, 0],
  );
  assert.equal(preview.deltaCents, 2 * 8000 + (8 + 10) * 200);
  for (const day of preview.days) {
    assert.equal(
      day.ledger.filter((entry) => entry.category === "base_revenue").length,
      1,
    );
    assert.equal(
      day.ledger.find((entry) => entry.category === "base_revenue")
        ?.amountCents,
      36000,
    );
    assert.equal(
      day.ledger
        .filter((entry) => entry.category === "delivery_cost")
        .reduce((s, e) => s + e.amountCents, 0),
      -day.deliveryStops * 50,
    );
    assert.ok(day.characters.ahe.deliveryStops <= 6);
    assert.ok(day.characters.xiaoman.deliveryStops <= 6);
  }
});

test("two extra-order workers share limited demand and cannot manufacture sales", () => {
  const plan: Plan = {
    allocations: { ahe: "extra", xiaoman: "extra" },
    wageMode: "protected",
  };
  const preview = previewPlan(through(1), plan);
  assert.deepEqual(
    preview.days.map((day) => day.extraLoaves),
    [20, 12],
  );
  assert.deepEqual(
    preview.days.map((day) => day.characters.ahe.extraLoaves),
    [10, 6],
  );
  assert.deepEqual(
    preview.days.map((day) => day.characters.xiaoman.extraLoaves),
    [10, 6],
  );
  assert.equal(preview.deltaCents, 16000 + 32 * 420);
  const last = previewPlan(through(3), plan).days[0];
  assert.equal(last.extraLoaves, 8);
  assert.equal(last.characters.ahe.extraLoaves, 4);
  assert.equal(last.characters.xiaoman.extraLoaves, 4);
  assert.equal(last.characters.ahe.workedHours, 4);
  assert.equal(last.characters.ahe.wagesCents, 8000);
});

test("scene replay uses precise anchors and personal activity tied to the settled day", () => {
  const state = through(4);
  assert.equal(state.days[0].characters.ahe.personalDestination, "home");
  assert.equal(state.days[2].characters.ahe.personalDestination, "school");
  assert.equal(state.days[2].characters.ahe.personalActivity, "study");
  assert.equal(state.days[4].characters.xiaoman.personalDestination, "school");
  for (const day of state.days) {
    assert.equal(day.actions.length, 4);
    assert.equal(new Set(day.actions.map((action) => action.id)).size, 4);
    for (const id of ["ahe", "xiaoman"] as const) {
      assert.equal(
        day.characters[id].actions.reduce(
          (sum, action) => sum + action.hours,
          0,
        ),
        4,
      );
      assert.equal(day.characters[id].actions[0].kind, "base");
      assert.equal(day.characters[id].actions[0].anchor, "bakery");
      assert.equal(
        day.characters[id].actions[1].anchor,
        day.characters[id].personalDestination,
      );
    }
  }
});

test("save contains only a plan history and load replays identical checkpoints and reports", () => {
  let state = initialStory();
  for (let i = 0; i < 4; i++) state = confirmPlan(state, defaultPlan(state), i);
  const save = encodeStory(state);
  assert.equal(save.includes("cashCents"), false);
  assert.equal(save.includes("wagesCents"), false);
  const restored = decodeStory(save);
  assert.deepEqual(restored, state);
  assert.deepEqual(report(restored), report(state));
  assert.equal(encodeStory(restored), save);
  for (let count = 0; count <= 4; count++) {
    const checkpoint = replayCheckpoint(restored, count);
    assert.deepEqual(
      checkpoint.days,
      state.days.slice(0, [0, 2, 4, 6, 7][count]),
    );
    assert.equal(checkpoint.roundIndex, count);
  }
  assert.equal(state.roundIndex, 4);
});

test("load rejects arbitrary balances, unknown fields, gaps, extra rounds and invalid consent", () => {
  const valid = JSON.parse(encodeStory(through(1)));
  const corruptions = [
    { ...valid, cashCents: 9000000 },
    { ...valid, version: 2 },
    { ...valid, chapter: "other-chapter" },
    { ...valid, checkpoints: [{ ...valid.checkpoints[0], roundIndex: 1 }] },
    { ...valid, checkpoints: [{ ...valid.checkpoints[0], paid: true }] },
    {
      ...valid,
      checkpoints: [{ roundIndex: 0, plan: { ...rest, wageMode: "hourly" } }],
    },
    {
      ...valid,
      checkpoints: [
        {
          roundIndex: 0,
          plan: { ...rest, allocations: { ahe: "rest", xiaoman: "extra" } },
        },
      ],
    },
    {
      ...valid,
      checkpoints: [{ roundIndex: 0, plan: { ...rest, hiddenRevenue: 500 } }],
    },
    {
      ...valid,
      checkpoints: Array.from({ length: 5 }, (_, roundIndex) => ({
        roundIndex,
        plan: rest,
      })),
    },
  ];
  for (const corruption of corruptions)
    assert.throws(() => decodeStory(JSON.stringify(corruption)));
  for (const invalid of ["{", "null", "[]", "x".repeat(20001)])
    assert.throws(() => decodeStory(invalid));
  assert.throws(
    () => report({ ...initialStory(), cashCents: 9000000 }),
    /无效故事状态/,
  );
  assert.throws(
    () => previewPlan(JSON.parse(JSON.stringify(initialStory())), rest),
    /无效故事状态/,
  );
});

test("every permitted complete plan path has exact integer accounting and worker time conservation", () => {
  let completedPaths = 0;
  function visit(state: StoryState) {
    if (state.completed) {
      completedPaths++;
      const result = report(state);
      assert.equal(result.reconciled, true);
      assert.equal(result.freedHours, 28);
      assert.equal(result.personalHours + result.commercialHours, 28);
      assert.equal(
        result.openingCashCents + result.revenueCents - result.costCents,
        result.closingCashCents,
      );
      for (const id of ["ahe", "xiaoman"] as const)
        assert.equal(
          result.characters[id].workedHours +
            result.characters[id].personalHours,
          28,
        );
      return;
    }
    const ahe = availableChoices(state, "ahe")
      .filter((choice) => choice.available)
      .map((choice) => choice.id);
    const xiaoman = availableChoices(state, "xiaoman")
      .filter((choice) => choice.available)
      .map((choice) => choice.id);
    const wages = availableWageModes(state)
      .filter((choice) => choice.available)
      .map((choice) => choice.id);
    for (const a of ahe)
      for (const x of xiaoman)
        for (const wageMode of wages) {
          const plan: Plan = {
            allocations: { ahe: a as Activity, xiaoman: x as Activity },
            wageMode,
          };
          const preview = previewPlan(state, plan);
          for (const day of preview.days) {
            assert.equal(
              day.openingCashCents +
                day.ledger.reduce((sum, entry) => sum + entry.amountCents, 0),
              day.closingCashCents,
            );
            assert.ok(day.closingCashCents >= 0);
            assert.ok(day.extraLoaves <= day.extraDemand);
            assert.ok(day.deliveryStops <= day.deliveryDemand);
            for (const entry of day.ledger) {
              assert.ok(Number.isSafeInteger(entry.amountCents));
              assert.equal(
                Math.abs(entry.amountCents),
                entry.quantity * entry.unitCents,
              );
            }
          }
          const next = confirmPlan(state, plan, state.roundIndex);
          assert.equal(next.cashCents, preview.afterCashCents);
          visit(next);
        }
  }
  visit(initialStory());
  assert.equal(completedPaths, 6 * 6 * 4 * 18);
});

test("machine productivity and baseline assumptions are explicit model constants", () => {
  assert.equal(constants.manualWorkerHoursPerDay, 8);
  assert.equal(constants.machineWorkerHoursPerDay, 4);
  assert.equal(constants.freedHoursPerPerson, 2);
  assert.equal(constants.totalDays, 7);
});
