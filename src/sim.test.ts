import test from "node:test";
import assert from "node:assert/strict";
import {
  applyCommand,
  comparePolicies,
  createTown,
  DEFAULT_POLICY,
  deserialize,
  metrics,
  serialize,
  stepTown,
  validateState,
  type Command,
  type Policy,
  type Role,
  type TownState,
} from "./sim";
const mayor: Role = { type: "mayor" };
const resident: Role = { type: "resident", residentId: "r1" };
function run(seed: string | number, days: number, policy?: Partial<Policy>) {
  let town = createTown(seed);
  if (policy) town = applyCommand(town, { type: "setPolicy", policy }, mayor);
  for (let i = 0; i < days; i++) town = stepTown(town);
  return town;
}

test("creates a complete closed economy with valid balances and physical inventory", () => {
  const s = createTown("beginning");
  assert.deepEqual(validateState(s), []);
  assert.equal(s.residents.length, 16);
  assert.equal(s.households.length, 8);
  assert.equal(s.firms.length, 2);
  assert.equal(Object.keys(s.accounts).length, 19);
  assert.deepEqual(s.policy, DEFAULT_POLICY);
  assert.equal(metrics(s).totalMoneyCents, s.initialMoneyCents);
  assert.equal(metrics(s).totalInventory, s.initialInventory);
  assert.ok(metrics(s).moneyConserved);
  assert.ok(metrics(s).ledgerBalanced);
});

test("same seed and inputs repeat exactly; different seeds yield different initial conditions", () => {
  assert.equal(
    serialize(run("repeatable", 35)),
    serialize(run("repeatable", 35)),
  );
  assert.notEqual(serialize(createTown("one")), serialize(createTown("two")));
  assert.equal(serialize(createTown(42)), serialize(createTown("42")));
});

test("step and commands are immutable; commands never advance time", () => {
  const s = createTown("pure"),
    before = serialize(s);
  const next = stepTown(s);
  assert.equal(serialize(s), before);
  assert.equal(next.day, 1);
  const changed = applyCommand(
    s,
    { type: "setPolicy", policy: { incomeTaxRate: 40 } },
    mayor,
  );
  assert.equal(serialize(s), before);
  assert.equal(changed.day, 0);
  assert.equal(changed.policy.incomeTaxRate, 40);
  changed.residents[0].food++;
  assert.equal(s.residents[0].food, 1);
});

test("300 daily ticks preserve money, goods, nonnegative balances, and balanced accounting", () => {
  let s = createTown("long-run");
  for (let i = 0; i < 300; i++) {
    if (i === 80)
      s = applyCommand(
        s,
        {
          type: "setPolicy",
          policy: { incomeTaxRate: 35, ubiCents: 100, aiProductivity: 2 },
        },
        mayor,
      );
    if (i === 160)
      s = applyCommand(
        s,
        {
          type: "setPolicy",
          policy: { incomeTaxRate: 50, ubiCents: 500, aiProductivity: 3 },
        },
        mayor,
      );
    s = stepTown(s);
    assert.deepEqual(validateState(s), [], `day ${s.day}`);
    assert.equal(metrics(s).totalMoneyCents, s.initialMoneyCents);
    assert.equal(
      metrics(s).totalInventory,
      s.initialInventory + s.totalProduced - s.totalConsumed,
    );
    assert.ok(
      Object.values(s.accounts).every(
        (a) => Number.isSafeInteger(a.balanceCents) && a.balanceCents >= 0,
      ),
    );
    assert.ok(
      s.residents.every((r) => Number.isSafeInteger(r.food) && r.food >= 0),
    );
    assert.ok(
      s.firms.every(
        (f) => Number.isSafeInteger(f.inventory) && f.inventory >= 0,
      ),
    );
    assert.ok(
      s.ledger.every(
        (e) => e.postings.reduce((sum, p) => sum + p.deltaCents, 0) === 0,
      ),
    );
  }
  assert.equal(s.day, 300);
  assert.equal(s.history.length, 301);
  assert.ok(s.events.length <= 150);
});

test("transfers cannot create money or overdraw treasury; shortages are allocated equally", () => {
  let s = applyCommand(
    createTown("budget"),
    { type: "setPolicy", policy: { incomeTaxRate: 0, ubiCents: 500 } },
    mayor,
  );
  const openingTreasury = s.accounts.treasury.balanceCents;
  for (let i = 0; i < 7; i++) s = stepTown(s);
  const transfers = s.ledger.filter((e) => e.kind === "transfer");
  assert.equal(
    transfers.reduce((n, e) => n + e.amountCents, 0),
    openingTreasury,
  );
  assert.equal(s.accounts.treasury.balanceCents, 0);
  assert.equal(metrics(s).transfersCents, 0);
  assert.equal(metrics(s).transferFundingRate, 0);
  assert.equal(metrics(s).totalMoneyCents, s.initialMoneyCents);
  assert.ok(s.events.some((e) => e.message.includes("不足")));
  for (let day = 1; day <= 7; day++) {
    const payments = s.residents.map((r) =>
      transfers
        .filter((e) => e.day === day && e.to === r.accountId)
        .reduce((n, e) => n + e.amountCents, 0),
    );
    assert.ok(Math.max(...payments) - Math.min(...payments) <= 1);
  }
});

test("save/load continuation is byte-for-byte deterministic, including RNG and audit trail", () => {
  const initial = run("save-me", 24, {
    aiProductivity: 1.75,
    incomeTaxRate: 27,
  });
  let a = initial,
    b = deserialize(serialize(initial));
  assert.deepEqual(a, b);
  for (let i = 0; i < 30; i++) {
    a = stepTown(a);
    b = stepTown(b);
  }
  assert.equal(serialize(a), serialize(b));
});

test("observer may inspect but cannot mutate; resident cannot govern or act for another resident", () => {
  const s = createTown("roles");
  const policy: Command = { type: "setPolicy", policy: { incomeTaxRate: 30 } };
  assert.throws(
    () => applyCommand(s, policy, { type: "observer" }),
    /Observers/,
  );
  assert.throws(() => applyCommand(s, policy, resident), /Only the mayor/);
  assert.throws(
    () =>
      applyCommand(
        s,
        { type: "setWorkPreference", residentId: "r2", preference: "rest" },
        resident,
      ),
    /themselves/,
  );
  assert.throws(
    () =>
      applyCommand(
        s,
        { type: "buyFood", residentId: "r2", quantity: 1 },
        resident,
      ),
    /themselves/,
  );
  assert.throws(
    () =>
      applyCommand(
        s,
        { type: "buyFood", residentId: "r1", quantity: 1 },
        mayor,
      ),
    /themselves/,
  );
  assert.throws(
    () => applyCommand(s, policy, { type: "admin" } as unknown as Role),
    /Invalid role/,
  );
  assert.throws(
    () => applyCommand(s, policy, { type: "resident", residentId: "missing" }),
    /identity/,
  );
});

test("resident work and purchase commands affect only their authorized decisions", () => {
  const s = createTown("choices");
  const purchase = applyCommand(
    s,
    { type: "buyFood", residentId: "r1", quantity: 2 },
    resident,
  );
  assert.equal(purchase.residents[0].food, s.residents[0].food + 2);
  assert.equal(
    purchase.accounts.r1.balanceCents,
    s.accounts.r1.balanceCents - 240,
  );
  assert.equal(purchase.firms[0].inventory, s.firms[0].inventory - 2);
  assert.deepEqual(purchase.residents.slice(1), s.residents.slice(1));
  assert.deepEqual(validateState(purchase), []);
  const rest = applyCommand(
    s,
    { type: "setWorkPreference", residentId: "r1", preference: "rest" },
    resident,
  );
  assert.equal(stepTown(rest).residents[0].employerId, null);
});

test("unauthorized, malformed, fractional, infinite, and out-of-range commands are rejected", () => {
  const s = createTown("invalid");
  const before = serialize(s);
  const badPolicies: Partial<Policy>[] = [
    { incomeTaxRate: -1 },
    { incomeTaxRate: 51 },
    { incomeTaxRate: 1.5 },
    { ubiCents: -1 },
    { ubiCents: 501 },
    { ubiCents: 1.5 },
    { aiProductivity: 0 },
    { aiProductivity: 3.1 },
    { aiProductivity: NaN },
    { aiProductivity: Infinity },
    {},
    { hidden: 1 } as Partial<Policy>,
  ];
  for (const policy of badPolicies)
    assert.throws(() => applyCommand(s, { type: "setPolicy", policy }, mayor));
  for (const quantity of [-1, 0, 11, 1.5, NaN, Infinity])
    assert.throws(() =>
      applyCommand(
        s,
        { type: "buyFood", residentId: "r1", quantity },
        resident,
      ),
    );
  assert.throws(() =>
    applyCommand(
      s,
      {
        type: "setWorkPreference",
        residentId: "r1",
        preference: "fraud",
      } as unknown as Command,
      resident,
    ),
  );
  assert.throws(
    () =>
      applyCommand(
        s,
        { type: "mint", amount: 10000 } as unknown as Command,
        mayor,
      ),
    /Unknown/,
  );
  assert.throws(() => createTown(""));
  assert.throws(() => createTown(Infinity));
  assert.throws(() => createTown({} as string));
  assert.equal(serialize(s), before);
});

test("failed purchases are atomic, with no partial cash or inventory changes", () => {
  const s = createTown("atomic");
  const bought = applyCommand(
    s,
    { type: "buyFood", residentId: "r1", quantity: 10 },
    resident,
  );
  const before = serialize(bought);
  assert.throws(
    () =>
      applyCommand(
        bought,
        { type: "buyFood", residentId: "r1", quantity: 10 },
        resident,
      ),
    /Not enough/,
  );
  assert.equal(serialize(bought), before);
});

test("deserialize rejects malformed JSON, incompatible schemas, and accounting corruption", () => {
  const original = run("corruption", 3);
  assert.throws(() => deserialize("broken"), /JSON/);
  for (const value of [
    null,
    [],
    {},
    { ...original, version: 2 },
    { ...original, rngState: 0 },
  ])
    assert.throws(() => deserialize(JSON.stringify(value)));
  const mutate = (f: (s: TownState) => void) => {
    const s = structuredClone(original);
    f(s);
    assert.ok(validateState(s).length);
    assert.throws(() => deserialize(JSON.stringify(s)));
  };
  mutate((s) => {
    s.accounts.r1.balanceCents = -1;
  });
  mutate((s) => {
    s.accounts.r1.balanceCents += 100;
  });
  mutate((s) => {
    s.residents[0].food = 0.5;
  });
  mutate((s) => {
    s.firms[0].inventory++;
  });
  mutate((s) => {
    s.ledger[0].postings[0].deltaCents = 0;
  });
  mutate((s) => {
    s.ledger[0].from = "missing";
  });
  mutate((s) => {
    s.households[0].memberIds = ["r1", "r1"];
  });
  mutate((s) => {
    s.residents[0].employerId = "missing";
  });
  mutate((s) => {
    s.history.pop();
  });
  mutate((s) => {
    s.policy.ubiCents = 99999;
  });
  assert.ok(validateState({ residents: null }).length);
});

test("policy comparison uses exactly the same initial state and remains reproducible", () => {
  const variants = [
    { name: "Baseline", policy: { aiProductivity: 1 } },
    { name: "AI", policy: { aiProductivity: 3 } },
    { name: "Baseline clone", policy: { aiProductivity: 1 } },
  ];
  const a = comparePolicies("fair-comparison", variants, 20),
    b = comparePolicies("fair-comparison", variants, 20);
  assert.deepEqual(a, b);
  assert.deepEqual(a[0].final, a[2].final);
  assert.deepEqual(a[0].history[0], a[1].history[0]);
  assert.equal(a[0].final.totalMoneyCents, a[1].final.totalMoneyCents);
  assert.notDeepEqual(
    a[0].history.map((m) => m.employed),
    a[1].history.map((m) => m.employed),
  );
  assert.throws(() => comparePolicies("x", variants, 0));
  assert.throws(() => comparePolicies("x", [], 30));
});

test("fixed day count is independent of render/timer batching", () => {
  const tick = (s: TownState, n: number) => {
    for (let i = 0; i < n; i++) s = stepTown(s);
    return s;
  };
  const a = tick(createTown("batches"), 30);
  let b = createTown("batches");
  for (const n of [1, 4, 7, 3, 15]) b = tick(b, n);
  assert.equal(serialize(a), serialize(b));
});

test("policy edits do not rewrite the transfer request or funding rate for the current day", () => {
  const s = stepTown(createTown("snapshot"));
  const before = metrics(s);
  assert.equal(before.requestedTransfersCents, 640);
  const changed = applyCommand(
    s,
    { type: "setPolicy", policy: { ubiCents: 0 } },
    mayor,
  );
  assert.equal(
    metrics(changed).requestedTransfersCents,
    before.requestedTransfersCents,
  );
  assert.equal(
    metrics(changed).transferFundingRate,
    before.transferFundingRate,
  );
  const next = stepTown(changed);
  assert.equal(metrics(next).requestedTransfersCents, 0);
  assert.equal(metrics(next).transfersCents, 0);
  assert.equal(metrics(next).transferFundingRate, 100);
});

test("saved history requires complete metrics, valid ranges, and a reconciled current snapshot", () => {
  const original = run("history-schema", 2);
  for (const mutate of [
    (s: TownState) => {
      s.history[0] = { day: 0 } as unknown as (typeof s.history)[0];
    },
    (s: TownState) => {
      s.history[0].employmentRate = 101;
    },
    (s: TownState) => {
      s.history[0].moneyConserved = 1 as unknown as boolean;
    },
    (s: TownState) => {
      s.history[2].averageHunger = 50;
    },
    (s: TownState) => {
      s.requestedTransfersToday = 0;
    },
  ]) {
    const s = structuredClone(original);
    mutate(s);
    assert.throws(() => deserialize(JSON.stringify(s)));
  }
});

test("malicious event counters and implausible physical counters are rejected on import", () => {
  const initial = run("counters", 2);
  for (const mutate of [
    (s: TownState) => {
      s.nextEventId = Number.MAX_SAFE_INTEGER;
    },
    (s: TownState) => {
      s.nextEventId = s.events[s.events.length - 1].id + 2;
    },
    (s: TownState) => {
      s.events = [];
    },
    (s: TownState) => {
      s.events[s.events.length - 1].id = Number.MAX_SAFE_INTEGER - 1;
      s.nextEventId = Number.MAX_SAFE_INTEGER;
    },
    (s: TownState) => {
      s.totalProduced = Number.MAX_SAFE_INTEGER - 100;
      s.firms[0].inventory =
        s.initialInventory +
        s.totalProduced -
        s.totalConsumed -
        s.firms[1].inventory -
        s.residents.reduce((n, r) => n + r.food, 0);
    },
    (s: TownState) => {
      s.totalConsumed = Number.MAX_SAFE_INTEGER;
    },
    (s: TownState) => {
      s.residents[0].lastIncomeCents = Number.MAX_SAFE_INTEGER;
    },
    (s: TownState) => {
      s.firms[0].producedToday = Number.MAX_SAFE_INTEGER;
    },
    (s: TownState) => {
      s.ledger[0].kind = "purchase";
    },
  ]) {
    const s = structuredClone(initial);
    mutate(s);
    assert.ok(validateState(s).length);
    assert.throws(() => deserialize(JSON.stringify(s)));
  }
});
