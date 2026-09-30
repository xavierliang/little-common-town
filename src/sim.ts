/**
 * Little Common: a deterministic, closed-money toy economy.
 * All currency is integer cents. Each day is one simulation tick, independent
 * of the renderer. This is an inspectable experiment, not an economic forecast.
 */
export interface Policy {
  incomeTaxRate: number;
  ubiCents: number;
  aiProductivity: number;
}
export type Role =
  | { type: "observer" }
  | { type: "mayor" }
  | { type: "resident"; residentId: string };
export type Command =
  | { type: "grantAid"; residentId: string }
  | { type: "fundFirm"; firmId: string }
  | { type: "investAutomation" }
  | { type: "setPolicy"; policy: Partial<Policy> }
  | {
      type: "setWorkPreference";
      residentId: string;
      preference: "work" | "rest";
    }
  | { type: "buyFood"; residentId: string; quantity: number };
export interface Account {
  id: string;
  label: string;
  kind: "resident" | "firm" | "government";
  balanceCents: number;
  openingBalanceCents: number;
}
export interface Resident {
  id: string;
  name: string;
  householdId: string;
  accountId: string;
  employerId: string | null;
  skill: number;
  food: number;
  hunger: number;
  energy: number;
  wellbeing: number;
  workPreference: "work" | "rest";
  activity: string;
  position: { x: number; y: number };
  lastIncomeCents: number;
  lastSpentCents: number;
}
export interface Household {
  id: string;
  name: string;
  memberIds: string[];
  position: { x: number; y: number };
}
export interface Firm {
  id: string;
  name: string;
  accountId: string;
  ownerId: string;
  inventory: number;
  priceCents: number;
  wageCents: number;
  workerIds: string[];
  capacity: number;
  aiEnabled: boolean;
  producedToday: number;
  soldToday: number;
  position: { x: number; y: number };
}
export type LedgerKind =
  "wage" | "tax" | "transfer" | "purchase" | "dividend" | "investment" | "aid";
export interface LedgerEntry {
  id: number;
  day: number;
  kind: LedgerKind;
  from: string;
  to: string;
  amountCents: number;
  memo: string;
  postings: { accountId: string; deltaCents: number }[];
}
export interface TownEvent {
  id: number;
  day: number;
  kind: "economy" | "policy" | "resident" | "warning";
  message: string;
}
export interface Metrics {
  day: number;
  population: number;
  employed: number;
  employmentRate: number;
  averageWellbeing: number;
  averageHunger: number;
  averageEnergy: number;
  householdCashCents: number;
  firmCashCents: number;
  treasuryCents: number;
  totalMoneyCents: number;
  moneyConserved: boolean;
  ledgerBalanced: boolean;
  totalInventory: number;
  producedToday: number;
  consumedToday: number;
  unmetNeedsToday: number;
  taxRevenueCents: number;
  transfersCents: number;
  requestedTransfersCents: number;
  transferFundingRate: number;
  gini: number;
  averagePriceCents: number;
}
export interface TownState {
  version: 1;
  scenario?: "standard" | "challenge";
  seed: string;
  rngState: number;
  day: number;
  policy: Policy;
  residents: Resident[];
  households: Household[];
  firms: Firm[];
  accounts: Record<string, Account>;
  government: {
    accountId: string;
    taxRevenueToday: number;
    transfersToday: number;
  };
  ledger: LedgerEntry[];
  events: TownEvent[];
  history: Metrics[];
  initialMoneyCents: number;
  initialInventory: number;
  totalProduced: number;
  totalConsumed: number;
  consumedToday: number;
  unmetNeedsToday: number;
  requestedTransfersToday: number;
  nextEventId: number;
}
export interface PolicyComparison {
  name: string;
  policy: Policy;
  final: Metrics;
  history: Metrics[];
}
export const DEFAULT_POLICY: Readonly<Policy> = Object.freeze({
  incomeTaxRate: 20,
  ubiCents: 40,
  aiProductivity: 1,
});
const NAMES = [
  "Maya",
  "Theo",
  "Amina",
  "Jules",
  "Sofia",
  "Leo",
  "Noor",
  "Ben",
  "Iris",
  "Kai",
  "Elena",
  "Otis",
  "Priya",
  "Sam",
  "Luna",
  "Ezra",
];
const FIRM_POSITIONS = [
  { x: 27, y: 40 },
  { x: 73, y: 40 },
];
const HOUSE_POSITIONS = [
  { x: 14, y: 17 },
  { x: 38, y: 17 },
  { x: 62, y: 17 },
  { x: 86, y: 17 },
  { x: 14, y: 79 },
  { x: 38, y: 79 },
  { x: 62, y: 79 },
  { x: 86, y: 79 },
];
const isInt = (n: unknown): n is number =>
  typeof n === "number" && Number.isSafeInteger(n);
const inRange = (n: unknown, min: number, max: number) =>
  typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const copy = <T>(value: T): T => structuredClone(value);
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function hashSeed(seed: string): number {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0 || 1;
}
function random(state: TownState): number {
  let x = state.rngState;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  state.rngState = x >>> 0;
  return state.rngState / 4294967296;
}
function event(state: TownState, kind: TownEvent["kind"], message: string) {
  assert(
    isInt(state.nextEventId) &&
      state.nextEventId > 0 &&
      state.nextEventId < 1_000_000_000,
    "Event counter is outside the supported range",
  );
  state.events.push({ id: state.nextEventId++, day: state.day, kind, message });
  if (state.events.length > 150)
    state.events.splice(0, state.events.length - 150);
}
function checkPolicy(policy: unknown): asserts policy is Policy {
  assert(
    policy && typeof policy === "object" && !Array.isArray(policy),
    "Policy must be an object",
  );
  const p = policy as Policy;
  assert(
    Object.keys(p).every((k) =>
      ["incomeTaxRate", "ubiCents", "aiProductivity"].includes(k),
    ),
    "Unknown policy field",
  );
  assert(
    isInt(p.incomeTaxRate) && inRange(p.incomeTaxRate, 0, 50),
    "Income tax must be an integer from 0 to 50 percent",
  );
  assert(
    isInt(p.ubiCents) && inRange(p.ubiCents, 0, 500),
    "Transfer must be integer cents from 0 to 500",
  );
  assert(
    inRange(p.aiProductivity, 1, 3),
    "AI productivity must be between 1 and 3",
  );
}
function transfer(
  state: TownState,
  from: string,
  to: string,
  amountCents: number,
  kind: LedgerKind,
  memo: string,
) {
  assert(
    isInt(amountCents) && amountCents >= 0,
    "Transfer amount must be nonnegative integer cents",
  );
  if (amountCents === 0) return;
  assert(
    from !== to &&
      Object.hasOwn(state.accounts, from) &&
      Object.hasOwn(state.accounts, to),
    "Invalid transfer accounts",
  );
  assert(
    state.accounts[from].balanceCents >= amountCents,
    "Insufficient funds",
  );
  state.accounts[from].balanceCents -= amountCents;
  state.accounts[to].balanceCents += amountCents;
  state.ledger.push({
    id: state.ledger.length + 1,
    day: state.day,
    kind,
    from,
    to,
    amountCents,
    memo,
    postings: [
      { accountId: from, deltaCents: -amountCents },
      { accountId: to, deltaCents: amountCents },
    ],
  });
}
function payIncome(
  state: TownState,
  from: string,
  resident: Resident,
  gross: number,
  kind: "wage" | "dividend",
) {
  transfer(
    state,
    from,
    resident.accountId,
    gross,
    kind,
    `${resident.name}：${kind === "wage" ? "工资" : "分红"}`,
  );
  const tax = Math.floor((gross * state.policy.incomeTaxRate) / 100);
  transfer(
    state,
    resident.accountId,
    state.government.accountId,
    tax,
    "tax",
    `${resident.name}：所得税`,
  );
  state.government.taxRevenueToday += tax;
  resident.lastIncomeCents += gross - tax;
}
function buy(
  state: TownState,
  resident: Resident,
  quantity: number,
  strict: boolean,
) {
  const shops = [...state.firms].sort(
    (a, b) => a.priceCents - b.priceCents || a.id.localeCompare(b.id),
  );
  if (strict) {
    let funds = state.accounts[resident.accountId].balanceCents,
      left = quantity;
    for (const shop of shops) {
      const n = Math.min(
        left,
        shop.inventory,
        Math.floor(funds / shop.priceCents),
      );
      funds -= n * shop.priceCents;
      left -= n;
    }
    assert(left === 0, "Not enough cash or available food for this purchase");
  }
  let remaining = quantity;
  for (const shop of shops) {
    const n = Math.min(
      remaining,
      shop.inventory,
      Math.floor(
        state.accounts[resident.accountId].balanceCents / shop.priceCents,
      ),
    );
    if (n <= 0) continue;
    const cost = n * shop.priceCents;
    transfer(
      state,
      resident.accountId,
      shop.accountId,
      cost,
      "purchase",
      `${resident.name}：从${shop.name}购买 ${n} 份食物`,
    );
    resident.lastSpentCents += cost;
    resident.food += n;
    shop.inventory -= n;
    shop.soldToday += n;
    remaining -= n;
    resident.activity = `在${shop.name}购物`;
    resident.position = { ...shop.position };
    if (remaining === 0) break;
  }
}
export function createTown(
  seed: string | number = "little-common",
  scenario: "standard" | "challenge" = "standard",
): TownState {
  assert(
    typeof seed === "string" ||
      (typeof seed === "number" && Number.isFinite(seed)),
    "Seed must be a string or finite number",
  );
  const normalized = String(seed);
  assert(
    normalized.length > 0 && normalized.length <= 128,
    "Seed must contain 1–128 characters",
  );
  const state: TownState = {
    version: 1,
    scenario,
    seed: normalized,
    rngState: hashSeed(normalized),
    day: 0,
    policy: { ...DEFAULT_POLICY },
    residents: [],
    households: [],
    firms: [],
    accounts: {},
    government: {
      accountId: "treasury",
      taxRevenueToday: 0,
      transfersToday: 0,
    },
    ledger: [],
    events: [],
    history: [],
    initialMoneyCents: 0,
    initialInventory: 0,
    totalProduced: 0,
    totalConsumed: 0,
    consumedToday: 0,
    unmetNeedsToday: 0,
    requestedTransfersToday: 0,
    nextEventId: 1,
  };
  function account(
    id: string,
    label: string,
    kind: Account["kind"],
    balance: number,
  ) {
    state.accounts[id] = {
      id,
      label,
      kind,
      balanceCents: balance,
      openingBalanceCents: balance,
    };
  }
  account(
    "treasury",
    "小镇财政",
    "government",
    scenario === "challenge" ? 4000 : 24000,
  );
  for (let i = 0; i < 8; i++)
    state.households.push({
      id: `h${i + 1}`,
      name: `${NAMES[i * 2]} & ${NAMES[i * 2 + 1]}`,
      memberIds: [`r${i * 2 + 1}`, `r${i * 2 + 2}`],
      position: { ...HOUSE_POSITIONS[i] },
    });
  for (let i = 0; i < 16; i++) {
    const id = `r${i + 1}`,
      home = state.households[Math.floor(i / 2)];
    account(
      id,
      NAMES[i],
      "resident",
      scenario === "challenge"
        ? 100 + Math.floor(random(state) * 151)
        : 2500 + Math.floor(random(state) * 1501),
    );
    state.residents.push({
      id,
      name: NAMES[i],
      householdId: home.id,
      accountId: id,
      employerId: null,
      skill: 45 + Math.floor(random(state) * 51),
      food: 1,
      hunger: 0,
      energy: 85,
      wellbeing: 85,
      workPreference: "work",
      activity: "在家休息",
      position: { ...home.position },
      lastIncomeCents: 0,
      lastSpentCents: 0,
    });
  }
  for (let i = 0; i < 2; i++) {
    const id = `f${i + 1}`,
      name = i === 0 ? "麦穗合作社" : "晨光食品坊";
    account(id, name, "firm", scenario === "challenge" ? 800 : 20000);
    state.firms.push({
      id,
      name,
      accountId: id,
      ownerId: i === 0 ? "r1" : "r9",
      inventory: 8,
      priceCents: i === 0 ? 120 : 125,
      wageCents: i === 0 ? 180 : 190,
      workerIds: [],
      capacity: 6,
      aiEnabled: true,
      producedToday: 0,
      soldToday: 0,
      position: { ...FIRM_POSITIONS[i] },
    });
  }
  state.initialMoneyCents = sum(
    Object.values(state.accounts).map((a) => a.balanceCents),
  );
  state.initialInventory =
    sum(state.firms.map((f) => f.inventory)) +
    sum(state.residents.map((r) => r.food));
  event(
    state,
    "economy",
    "小镇开始运转：16 位居民、两家食品企业，以及一个共同财政账户。",
  );
  state.history.push(metrics(state));
  return state;
}
export function stepTown(input: TownState): TownState {
  assertValid(input);
  const state = copy(input);
  state.day++;
  state.government.taxRevenueToday = 0;
  state.government.transfersToday = 0;
  state.consumedToday = 0;
  state.unmetNeedsToday = 0;
  for (const r of state.residents) {
    r.employerId = null;
    r.lastIncomeCents = 0;
    r.lastSpentCents = 0;
    r.activity = "寻找工作";
  }
  // Hiring is demand-led. AI raises output per worker; it does not create money.
  const candidates = state.residents
    .filter((r) => r.workPreference === "work" && r.energy >= 15)
    .map((r) => ({ r, score: r.skill * 0.3 + random(state) * 70 }))
    .sort((a, b) => b.score - a.score || a.r.id.localeCompare(b.r.id));
  // Alternate first hiring rights so neither firm always gets first pick.
  const firms = state.day % 2 ? state.firms : [...state.firms].reverse();
  for (const f of firms) {
    f.producedToday = 0;
    f.soldToday = 0;
    f.workerIds = [];
    const productivity = 2 * (f.aiEnabled ? state.policy.aiProductivity : 1);
    const target = Math.max(0, 10 - f.inventory);
    const hires = Math.min(
      f.capacity,
      Math.ceil(target / productivity),
      Math.floor(state.accounts[f.accountId].balanceCents / f.wageCents),
    );
    for (let i = 0; i < hires && candidates.length; i++) {
      const r = candidates.shift()!.r;
      f.workerIds.push(r.id);
      r.employerId = f.id;
      payIncome(state, f.accountId, r, f.wageCents, "wage");
      r.energy = Math.max(0, r.energy - 10);
      r.activity = `在${f.name}工作`;
      r.position = { ...f.position };
    }
    f.producedToday = Math.floor(f.workerIds.length * productivity);
    f.inventory += f.producedToday;
    state.totalProduced += f.producedToday;
  }
  for (const r of state.residents)
    if (!r.employerId) {
      r.energy = Math.min(100, r.energy + 12);
      r.activity =
        r.workPreference === "rest" ? "暂停工作，休息中" : "今天没有可用岗位";
    }
  // Every allocated cent was already in the treasury. Remainders rotate fairly.
  const requested = state.policy.ubiCents * state.residents.length;
  state.requestedTransfersToday = requested;
  const funded = Math.min(
    requested,
    state.accounts[state.government.accountId].balanceCents,
  );
  const share = Math.floor(funded / state.residents.length),
    remainder = funded % state.residents.length;
  for (let i = 0; i < state.residents.length; i++) {
    const r = state.residents[(i + state.day) % state.residents.length],
      amount = share + (i < remainder ? 1 : 0);
    transfer(
      state,
      state.government.accountId,
      r.accountId,
      amount,
      "transfer",
      `${r.name}：每日居民补贴`,
    );
    r.lastIncomeCents += amount;
    state.government.transfersToday += amount;
  }
  if (
    funded < requested &&
    (state.day === 1 ||
      input.government.transfersToday >= requested ||
      state.day % 7 === 0)
  )
    event(
      state,
      "warning",
      "财政余额不足以全额发放补贴。可用余额会公平分配，不借债，也不凭空增发货币。",
    );
  // Rotating shopping order avoids permanently favoring the first resident.
  for (let i = 0; i < state.residents.length; i++) {
    const r = state.residents[(i + state.day) % state.residents.length];
    buy(state, r, Math.max(0, 2 - r.food), false);
    if (r.food > 0) {
      r.food--;
      state.totalConsumed++;
      state.consumedToday++;
      r.hunger = Math.max(0, r.hunger - 25);
      r.energy = Math.min(100, r.energy + 5);
    } else {
      state.unmetNeedsToday++;
      r.hunger = Math.min(100, r.hunger + 25);
      r.energy = Math.max(0, r.energy - 8);
      r.activity = "需要食物";
    }
    const financialComfort = Math.min(
      100,
      state.accounts[r.accountId].balanceCents / 35,
    );
    r.wellbeing = Math.round(
      clamp(
        (100 - r.hunger) * 0.6 + r.energy * 0.2 + financialComfort * 0.2,
        0,
        100,
      ),
    );
    if (r.activity !== "需要食物")
      r.activity = r.employerId
        ? "下班回家"
        : r.workPreference === "rest"
          ? "在家休息"
          : "在家等待工作";
    r.position = {
      ...state.households.find((h) => h.id === r.householdId)!.position,
    };
  }
  // Owners receive only cash above the business's initial working-capital reserve.
  for (const f of state.firms) {
    const profit = Math.max(
      0,
      state.accounts[f.accountId].balanceCents -
        state.accounts[f.accountId].openingBalanceCents -
        state.ledger
          .filter((e) => e.kind === "investment" && e.to === f.accountId)
          .reduce((sum, e) => sum + e.amountCents, 0),
    );
    if (profit)
      payIncome(
        state,
        f.accountId,
        state.residents.find((r) => r.id === f.ownerId)!,
        profit,
        "dividend",
      );
  }
  if (state.unmetNeedsToday)
    event(
      state,
      "warning",
      `今天有 ${state.unmetNeedsToday} 位居民没有吃上饭。`,
    );
  if (state.day === 1 || state.day % 7 === 0)
    event(
      state,
      "economy",
      `第 ${state.day} 天：${state.firms.reduce((n, f) => n + f.workerIds.length, 0)} 位居民上班，消耗 ${state.consumedToday} 份食物。`,
    );
  state.history.push(metrics(state));
  assertValid(state);
  return state;
}
export function applyCommand(
  input: TownState,
  command: Command,
  role: Role,
): TownState {
  assertValid(input);
  assert(
    role &&
      typeof role === "object" &&
      ["observer", "mayor", "resident"].includes(role.type),
    "Invalid role",
  );
  assert(role.type !== "observer", "Observers cannot change the town");
  if (role.type === "resident")
    assert(
      input.residents.some((r) => r.id === role.residentId),
      "Unknown resident identity",
    );
  assert(command && typeof command === "object", "Command must be an object");
  const state = copy(input);
  if (
    command.type === "grantAid" ||
    command.type === "fundFirm" ||
    command.type === "investAutomation"
  ) {
    assert(role.type === "mayor", "Only the mayor can spend public funds");
    if (command.type === "grantAid") {
      const resident = state.residents.find((r) => r.id === command.residentId);
      assert(resident, "Unknown resident");
      transfer(
        state,
        state.government.accountId,
        resident.accountId,
        180,
        "aid",
        `${resident.name}：定向救助`,
      );
      resident.lastIncomeCents += 180;
      event(
        state,
        "resident",
        `为 ${resident.name} 发放 ¥1.80 救助，可购买至少一餐。`,
      );
    } else if (command.type === "fundFirm") {
      const firm = state.firms.find((f) => f.id === command.firmId);
      assert(firm, "Unknown firm");
      transfer(
        state,
        state.government.accountId,
        firm.accountId,
        600,
        "investment",
        `${firm.name}：工资周转金`,
      );
      event(
        state,
        "economy",
        `投入 ¥6.00 到 ${firm.name}，补充工资周转金；实际招聘仍取决于库存需求。`,
      );
    } else {
      assert(
        state.policy.aiProductivity < 3,
        "Automation is already at maximum",
      );
      assert(
        state.accounts[state.government.accountId].balanceCents >= 1000,
        "Insufficient funds",
      );
      for (const firm of state.firms)
        transfer(
          state,
          state.government.accountId,
          firm.accountId,
          500,
          "investment",
          `${firm.name}：自动化设备投入`,
        );
      state.policy.aiProductivity = Math.min(
        3,
        state.policy.aiProductivity + 0.5,
      );
      event(
        state,
        "economy",
        `投入 ¥10.00，全镇 AI 生产效率升至 ${state.policy.aiProductivity} 倍；同样产量可能需要更少岗位。`,
      );
    }
  } else if (command.type === "setPolicy") {
    assert(role.type === "mayor", "Only the mayor can set town policy");
    assert(
      command.policy &&
        typeof command.policy === "object" &&
        !Array.isArray(command.policy),
      "Policy update must be an object",
    );
    assert(
      Object.keys(command.policy).length > 0,
      "Policy update must not be empty",
    );
    const policy = { ...state.policy, ...command.policy };
    checkPolicy(policy);
    state.policy = policy;
    event(
      state,
      "policy",
      `政策更新：所得税 ${policy.incomeTaxRate}%，每日补贴 ¥${(policy.ubiCents / 100).toFixed(2)}，AI 效率 ${policy.aiProductivity.toFixed(2)} 倍。`,
    );
  } else if (
    command.type === "setWorkPreference" ||
    command.type === "buyFood"
  ) {
    assert(
      role.type === "resident" && role.residentId === command.residentId,
      "Residents can act only for themselves",
    );
    const r = state.residents.find((x) => x.id === command.residentId);
    assert(r, "Unknown resident");
    if (command.type === "setWorkPreference") {
      assert(
        command.preference === "work" || command.preference === "rest",
        "Invalid work preference",
      );
      r.workPreference = command.preference;
      event(
        state,
        "resident",
        `${r.name}${command.preference === "work" ? "将开始寻找工作" : "暂停工作，直到重新选择工作"}。`,
      );
    } else {
      assert(
        isInt(command.quantity) && inRange(command.quantity, 1, 10),
        "Purchase quantity must be an integer from 1 to 10",
      );
      buy(state, r, command.quantity, true);
      event(state, "resident", `${r.name}购买了 ${command.quantity} 份食物。`);
    }
  } else throw new Error("Unknown command");
  // A command changes the current snapshot, never advances the simulation clock.
  state.history[state.history.length - 1] = metrics(state);
  assertValid(state);
  return state;
}
export function metrics(state: TownState): Metrics {
  const residents = state.residents,
    population = residents.length;
  const householdWealth = state.households
    .map((h) =>
      sum(
        h.memberIds.map(
          (id) =>
            state.accounts[residents.find((r) => r.id === id)!.accountId]
              .balanceCents,
        ),
      ),
    )
    .sort((a, b) => a - b);
  const householdCashCents = sum(householdWealth),
    firmCashCents = sum(
      state.firms.map((f) => state.accounts[f.accountId].balanceCents),
    );
  const treasuryCents = state.accounts[state.government.accountId].balanceCents;
  const totalMoneyCents = sum(
    Object.values(state.accounts).map((a) => a.balanceCents),
  );
  const employed = residents.filter((r) => r.employerId !== null).length;
  const requestedTransfersCents = state.requestedTransfersToday;
  const weightedWealth = householdWealth.reduce(
      (n, w, i) => n + (i + 1) * w,
      0,
    ),
    n = householdWealth.length;
  return {
    day: state.day,
    population,
    employed,
    employmentRate: (employed / population) * 100,
    averageWellbeing: sum(residents.map((r) => r.wellbeing)) / population,
    averageHunger: sum(residents.map((r) => r.hunger)) / population,
    averageEnergy: sum(residents.map((r) => r.energy)) / population,
    householdCashCents,
    firmCashCents,
    treasuryCents,
    totalMoneyCents,
    moneyConserved: totalMoneyCents === state.initialMoneyCents,
    ledgerBalanced: state.ledger.every(
      (e) =>
        e.postings.length === 2 &&
        e.postings[0].accountId === e.from &&
        e.postings[0].deltaCents === -e.amountCents &&
        e.postings[1].accountId === e.to &&
        e.postings[1].deltaCents === e.amountCents,
    ),
    totalInventory:
      sum(state.firms.map((f) => f.inventory)) +
      sum(residents.map((r) => r.food)),
    producedToday: sum(state.firms.map((f) => f.producedToday)),
    consumedToday: state.consumedToday,
    unmetNeedsToday: state.unmetNeedsToday,
    taxRevenueCents: state.government.taxRevenueToday,
    transfersCents: state.government.transfersToday,
    requestedTransfersCents,
    transferFundingRate: requestedTransfersCents
      ? (state.government.transfersToday / requestedTransfersCents) * 100
      : 100,
    gini: householdCashCents
      ? (2 * weightedWealth) / (n * householdCashCents) - (n + 1) / n
      : 0,
    averagePriceCents:
      sum(state.firms.map((f) => f.priceCents)) / state.firms.length,
  };
}
/** Returns all detected invariant failures; malformed external saves never crash this checker. */
export function validateState(value: unknown): string[] {
  const errors: string[] = [];
  const check = (ok: unknown, message: string) => {
    if (!ok) errors.push(message);
  };
  try {
    assert(
      value && typeof value === "object" && !Array.isArray(value),
      "State must be an object",
    );
    const s = value as TownState;
    check(s.version === 1, "Unsupported save version");
    check(
      s.scenario === undefined ||
        ["standard", "challenge"].includes(s.scenario),
      "Invalid scenario",
    );
    check(
      typeof s.seed === "string" && s.seed.length > 0 && s.seed.length <= 128,
      "Invalid seed",
    );
    check(
      isInt(s.rngState) && inRange(s.rngState, 1, 4294967295),
      "Invalid random state",
    );
    check(isInt(s.day) && s.day >= 0, "Invalid day");
    try {
      checkPolicy(s.policy);
    } catch (e) {
      errors.push((e as Error).message);
    }
    assert(
      Array.isArray(s.residents) && s.residents.length === 16,
      "Town must have 16 residents",
    );
    assert(
      Array.isArray(s.households) && s.households.length === 8,
      "Town must have 8 households",
    );
    assert(
      Array.isArray(s.firms) && s.firms.length === 2,
      "Town must have 2 firms",
    );
    assert(
      s.accounts &&
        typeof s.accounts === "object" &&
        !Array.isArray(s.accounts),
      "Invalid accounts",
    );
    assert(
      Array.isArray(s.ledger) &&
        Array.isArray(s.history) &&
        Array.isArray(s.events),
      "Invalid records",
    );
    check(
      Object.keys(s.accounts).length === 19,
      "Town must have 19 cash accounts",
    );
    const residentIds = new Set(s.residents.map((r) => r.id)),
      firmIds = new Set(s.firms.map((f) => f.id)),
      householdIds = new Set(s.households.map((h) => h.id));
    check(
      residentIds.size === 16 && firmIds.size === 2 && householdIds.size === 8,
      "Duplicate entity identifiers",
    );
    const balances: Record<string, number> = Object.create(null);
    for (const [id, a] of Object.entries(s.accounts)) {
      check(
        a &&
          a.id === id &&
          typeof a.label === "string" &&
          ["resident", "firm", "government"].includes(a.kind),
        `Invalid account ${id}`,
      );
      check(
        isInt(a.balanceCents) &&
          a.balanceCents >= 0 &&
          isInt(a.openingBalanceCents) &&
          a.openingBalanceCents >= 0,
        `Invalid balance ${id}`,
      );
      check(
        a.kind === "resident"
          ? s.scenario === "challenge"
            ? inRange(a.openingBalanceCents, 100, 250)
            : inRange(a.openingBalanceCents, 2500, 4000)
          : a.kind === "firm"
            ? a.openingBalanceCents ===
              (s.scenario === "challenge" ? 800 : 20000)
            : a.openingBalanceCents ===
              (s.scenario === "challenge" ? 4000 : 24000),
        `Invalid opening endowment ${id}`,
      );
      balances[id] = a.openingBalanceCents;
    }
    const referencedAccounts = [
      ...s.residents.map((r) => r.accountId),
      ...s.firms.map((f) => f.accountId),
      s.government.accountId,
    ];
    check(
      new Set(referencedAccounts).size === 19,
      "Each entity needs a distinct account",
    );
    check(
      s.accounts[s.government.accountId]?.kind === "government",
      "Invalid treasury account",
    );
    const positionOK = (p: { x: number; y: number }) =>
      p && inRange(p.x, 0, 100) && inRange(p.y, 0, 100);
    for (const r of s.residents) {
      check(
        typeof r.id === "string" &&
          typeof r.name === "string" &&
          r.name.length > 0,
        "Invalid resident identity",
      );
      check(
        s.accounts[r.accountId]?.kind === "resident" &&
          householdIds.has(r.householdId),
        `Invalid resident references: ${r.id}`,
      );
      check(
        r.employerId === null || firmIds.has(r.employerId),
        `Invalid employer: ${r.id}`,
      );
      check(
        ["work", "rest"].includes(r.workPreference) &&
          typeof r.activity === "string" &&
          positionOK(r.position),
        `Invalid resident state: ${r.id}`,
      );
      check(
        isInt(r.food) &&
          inRange(r.food, 0, s.initialInventory + s.totalProduced) &&
          [r.lastIncomeCents, r.lastSpentCents].every(
            (n) => isInt(n) && inRange(n, 0, s.initialMoneyCents),
          ),
        `Invalid resident quantities: ${r.id}`,
      );
      check(
        [r.skill, r.hunger, r.energy, r.wellbeing].every(
          (n) => isInt(n) && inRange(n, 0, 100),
        ),
        `Invalid resident needs: ${r.id}`,
      );
    }
    const memberIds: string[] = [];
    for (const h of s.households) {
      check(
        typeof h.id === "string" &&
          typeof h.name === "string" &&
          positionOK(h.position),
        "Invalid household",
      );
      assert(Array.isArray(h.memberIds), "Invalid household members");
      memberIds.push(...h.memberIds);
      check(
        h.memberIds.length === 2 &&
          h.memberIds.every((id) =>
            s.residents.some((r) => r.id === id && r.householdId === h.id),
          ),
        "Household membership mismatch",
      );
    }
    check(
      memberIds.length === 16 && new Set(memberIds).size === 16,
      "Every resident must have exactly one household",
    );
    const employees: string[] = [];
    for (const f of s.firms) {
      check(
        typeof f.id === "string" &&
          typeof f.name === "string" &&
          positionOK(f.position) &&
          typeof f.aiEnabled === "boolean",
        "Invalid firm",
      );
      check(
        s.accounts[f.accountId]?.kind === "firm" && residentIds.has(f.ownerId),
        "Invalid firm references",
      );
      check(
        [f.inventory, f.soldToday].every(
          (n) =>
            isInt(n) && inRange(n, 0, s.initialInventory + s.totalProduced),
        ) &&
          isInt(f.producedToday) &&
          inRange(f.producedToday, 0, 96),
        "Invalid firm inventory",
      );
      check(
        isInt(f.priceCents) &&
          f.priceCents > 0 &&
          isInt(f.wageCents) &&
          f.wageCents > 0 &&
          isInt(f.capacity) &&
          inRange(f.capacity, 1, 16),
        "Invalid firm economics",
      );
      assert(Array.isArray(f.workerIds), "Invalid workforce");
      employees.push(...f.workerIds);
      check(
        f.workerIds.length <= f.capacity &&
          f.workerIds.every((id) =>
            s.residents.some((r) => r.id === id && r.employerId === f.id),
          ),
        "Workforce mismatch",
      );
    }
    check(
      new Set(employees).size === employees.length &&
        s.residents.every(
          (r) => (r.employerId !== null) === employees.includes(r.id),
        ),
      "Employment mismatch",
    );
    let priorDay = 0;
    const kinds: LedgerKind[] = [
      "wage",
      "tax",
      "transfer",
      "purchase",
      "dividend",
      "investment",
      "aid",
    ];
    for (let i = 0; i < s.ledger.length; i++) {
      const e = s.ledger[i];
      check(
        e.id === i + 1 &&
          isInt(e.day) &&
          e.day >= priorDay &&
          e.day <= s.day &&
          kinds.includes(e.kind) &&
          typeof e.memo === "string",
        "Invalid ledger metadata",
      );
      priorDay = e.day;
      assert(
        isInt(e.amountCents) &&
          e.amountCents > 0 &&
          e.from !== e.to &&
          Object.hasOwn(balances, e.from) &&
          Object.hasOwn(balances, e.to),
        "Invalid ledger transfer",
      );
      check(
        Array.isArray(e.postings) &&
          e.postings.length === 2 &&
          e.postings[0].accountId === e.from &&
          e.postings[0].deltaCents === -e.amountCents &&
          e.postings[1].accountId === e.to &&
          e.postings[1].deltaCents === e.amountCents,
        "Unbalanced ledger entry",
      );
      const sourceKind = s.accounts[e.from].kind,
        targetKind = s.accounts[e.to].kind;
      check(
        e.kind === "tax"
          ? sourceKind === "resident" && targetKind === "government"
          : e.kind === "investment"
            ? sourceKind === "government" && targetKind === "firm"
            : e.kind === "transfer" || e.kind === "aid"
              ? sourceKind === "government" && targetKind === "resident"
              : e.kind === "purchase"
                ? sourceKind === "resident" && targetKind === "firm"
                : sourceKind === "firm" && targetKind === "resident",
        "Ledger transaction kind does not match accounts",
      );
      balances[e.from] -= e.amountCents;
      balances[e.to] += e.amountCents;
      check(balances[e.from] >= 0, "Ledger overdraws an account");
    }
    check(
      Object.values(s.accounts).every((a) => balances[a.id] === a.balanceCents),
      "Account balances do not reconcile with ledger",
    );
    check(
      isInt(s.initialMoneyCents) &&
        s.initialMoneyCents ===
          sum(Object.values(s.accounts).map((a) => a.openingBalanceCents)) &&
        s.initialMoneyCents ===
          sum(Object.values(s.accounts).map((a) => a.balanceCents)),
      "Money conservation failed",
    );
    check(
      [
        s.initialInventory,
        s.totalProduced,
        s.totalConsumed,
        s.consumedToday,
        s.unmetNeedsToday,
        s.requestedTransfersToday,
        s.government.taxRevenueToday,
        s.government.transfersToday,
      ].every((n) => isInt(n) && n >= 0),
      "Invalid aggregate totals",
    );
    check(
      s.initialInventory === 32 &&
        s.totalProduced <= s.day * 96 &&
        s.totalConsumed <= s.day * 16,
      "Implausible cumulative production or consumption",
    );
    check(
      s.initialInventory + s.totalProduced - s.totalConsumed ===
        sum(s.firms.map((f) => f.inventory)) +
          sum(s.residents.map((r) => r.food)),
      "Food conservation failed",
    );
    check(
      s.consumedToday + s.unmetNeedsToday === (s.day === 0 ? 0 : 16),
      "Daily consumption does not reconcile",
    );
    check(
      s.government.taxRevenueToday ===
        sum(
          s.ledger
            .filter((e) => e.day === s.day && e.kind === "tax")
            .map((e) => e.amountCents),
        ),
      "Tax total does not reconcile",
    );
    check(
      s.government.transfersToday ===
        sum(
          s.ledger
            .filter((e) => e.day === s.day && e.kind === "transfer")
            .map((e) => e.amountCents),
        ),
      "Transfer total does not reconcile",
    );
    check(
      s.government.transfersToday <= s.requestedTransfersToday &&
        s.requestedTransfersToday <= 8000,
      "Transfers exceed the daily request",
    );
    const integerMetricKeys = [
      "day",
      "population",
      "employed",
      "householdCashCents",
      "firmCashCents",
      "treasuryCents",
      "totalMoneyCents",
      "totalInventory",
      "producedToday",
      "consumedToday",
      "unmetNeedsToday",
      "taxRevenueCents",
      "transfersCents",
      "requestedTransfersCents",
    ];
    const rateMetricKeys = [
      "employmentRate",
      "averageWellbeing",
      "averageHunger",
      "averageEnergy",
      "transferFundingRate",
    ];
    const metricKeys = [
      ...integerMetricKeys,
      ...rateMetricKeys,
      "moneyConserved",
      "ledgerBalanced",
      "gini",
      "averagePriceCents",
    ];
    check(
      s.history.length === s.day + 1 &&
        s.history.every((m, i) => {
          if (!m || typeof m !== "object") return false;
          const record = m as unknown as Record<string, unknown>;
          return (
            m.day === i &&
            Object.keys(m).length === metricKeys.length &&
            metricKeys.every((k) => Object.hasOwn(m, k)) &&
            integerMetricKeys.every(
              (k) => isInt(record[k]) && (record[k] as number) >= 0,
            ) &&
            rateMetricKeys.every((k) => inRange(record[k], 0, 100)) &&
            typeof m.moneyConserved === "boolean" &&
            typeof m.ledgerBalanced === "boolean" &&
            inRange(m.gini, 0, 1) &&
            inRange(m.averagePriceCents, 1, Number.MAX_SAFE_INTEGER) &&
            m.population === 16 &&
            m.employed <= 16 &&
            m.totalMoneyCents === s.initialMoneyCents &&
            m.moneyConserved &&
            m.ledgerBalanced &&
            m.transfersCents <= m.requestedTransfersCents &&
            m.householdCashCents + m.firmCashCents + m.treasuryCents ===
              m.totalMoneyCents
          );
        }),
      "Invalid metric history",
    );
    const current = metrics(s),
      latest = s.history[s.history.length - 1];
    check(
      latest &&
        metricKeys.every(
          (k) => latest[k as keyof Metrics] === current[k as keyof Metrics],
        ),
      "Current metrics do not match state",
    );
    check(
      isInt(s.nextEventId) &&
        inRange(s.nextEventId, 2, 999_999_990) &&
        s.events.length > 0 &&
        s.nextEventId === s.events[s.events.length - 1].id + 1 &&
        s.events.length <= 150 &&
        s.events.every(
          (e, i) =>
            isInt(e.id) &&
            e.id > 0 &&
            e.id < s.nextEventId &&
            (!i || s.events[i - 1].id < e.id) &&
            isInt(e.day) &&
            e.day <= s.day &&
            e.day >= 0 &&
            ["economy", "policy", "resident", "warning"].includes(e.kind) &&
            typeof e.message === "string",
        ),
      "Invalid event history",
    );
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "Malformed state");
  }
  return [...new Set(errors)];
}
function assertValid(state: unknown): asserts state is TownState {
  const errors = validateState(state);
  assert(errors.length === 0, `Invalid town state: ${errors.join("; ")}`);
}
export function serialize(state: TownState): string {
  assertValid(state);
  return JSON.stringify(state);
}
export function deserialize(json: string): TownState {
  assert(
    typeof json === "string" && json.length <= 30_000_000,
    "Save must be JSON smaller than 30 MB",
  );
  let result: unknown;
  try {
    result = JSON.parse(json);
  } catch {
    throw new Error("Save is not valid JSON");
  }
  assertValid(result);
  return copy(result);
}
export function comparePolicies(
  seed: string | number,
  policies: { name: string; policy: Partial<Policy> }[],
  days = 30,
): PolicyComparison[] {
  assert(
    isInt(days) && inRange(days, 1, 365),
    "Comparison duration must be 1–365 days",
  );
  assert(
    Array.isArray(policies) && inRange(policies.length, 1, 8),
    "Compare 1–8 policies",
  );
  return policies.map((p) => {
    assert(
      p && typeof p.name === "string" && p.name.length > 0,
      "Policy name is required",
    );
    let state = applyCommand(
      createTown(seed),
      { type: "setPolicy", policy: p.policy },
      { type: "mayor" },
    );
    for (let i = 0; i < days; i++) state = stepTown(state);
    return {
      name: p.name,
      policy: state.policy,
      final: metrics(state),
      history: state.history,
    };
  });
}
