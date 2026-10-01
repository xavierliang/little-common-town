/** A deterministic fictional seven-day bakery. Money is always integer cents. */
export type CharacterId = "ahe" | "xiaoman";
export type Activity = "rest" | "delivery" | "extra";
export type WageMode = "protected" | "hourly";
export type SceneAnchor = "bakery" | "market" | "school" | "home";
export interface Plan {
  allocations: Record<CharacterId, Activity>;
  wageMode: WageMode;
}
export interface Character {
  id: CharacterId;
  name: string;
  role: string;
  color: string;
}
export interface Preference {
  quote: string;
  preferred: Activity;
  refused: Partial<Record<Activity, string>>;
  personalActivity: "rest" | "study";
  personalDestination: "home" | "school";
  personalDetail: string;
  hourlyConsent: boolean;
  wageQuote: string;
}
export interface Round {
  index: number;
  days: readonly number[];
  title: string;
  subtitle: string;
  narration: string;
  preferences: Record<CharacterId, Preference>;
}
export interface Choice {
  id: Activity;
  label: string;
  description: string;
  available: boolean;
  reason: string;
  preferred: boolean;
}
export interface WageChoice {
  id: WageMode;
  label: string;
  description: string;
  available: boolean;
  reason: string;
}
export interface LedgerEntry {
  id: string;
  category:
    | "base_revenue"
    | "base_ingredients"
    | "wages"
    | "machine"
    | "delivery_revenue"
    | "delivery_cost"
    | "extra_revenue"
    | "extra_ingredients";
  label: string;
  amountCents: number;
  quantity: number;
  unitCents: number;
  characterId?: CharacterId;
}
export interface SceneAction {
  id: string;
  day: number;
  characterId: CharacterId;
  kind: "base" | "rest" | "study" | "delivery" | "extra";
  anchor: SceneAnchor;
  hours: number;
  title: string;
  detail: string;
  breadCount: number;
  deliveryStops: number;
}
export interface CharacterDay {
  characterId: CharacterId;
  name: string;
  activity: Activity;
  workedHours: number;
  paidHours: number;
  personalHours: number;
  wagesCents: number;
  deliveryStops: number;
  extraLoaves: number;
  personalDestination: "home" | "school" | null;
  personalActivity: "rest" | "study" | null;
  dialogue: string;
  actions: readonly SceneAction[];
}
export interface DaySettlement {
  day: number;
  roundIndex: number;
  openingCashCents: number;
  closingCashCents: number;
  revenueCents: number;
  costCents: number;
  deltaCents: number;
  baseLoaves: number;
  extraLoaves: number;
  extraDemand: number;
  unfilledExtraDemand: number;
  deliveryStops: number;
  deliveryDemand: number;
  unservedDeliveryDemand: number;
  freedHours: number;
  ledger: readonly LedgerEntry[];
  characters: Record<CharacterId, CharacterDay>;
  actions: readonly SceneAction[];
}
export interface CharacterSummary {
  characterId: CharacterId;
  name: string;
  workedHours: number;
  paidHours: number;
  personalHours: number;
  restHours: number;
  studyHours: number;
  wagesCents: number;
  deliveryStops: number;
  extraLoaves: number;
}
export interface Checkpoint {
  roundIndex: number;
  plan: Plan;
  dayNumbers: readonly number[];
  openingCashCents: number;
  closingCashCents: number;
}
export interface StoryState {
  version: 1;
  chapter: "bread-after-baking";
  roundIndex: number;
  cashCents: number;
  completed: boolean;
  days: readonly DaySettlement[];
  history: readonly Checkpoint[];
}
export interface Preview {
  roundIndex: number;
  plan: Plan;
  beforeCashCents: number;
  afterCashCents: number;
  deltaCents: number;
  days: readonly DaySettlement[];
  characters: Record<CharacterId, CharacterSummary>;
  dialogue: Record<CharacterId, string>;
  notes: readonly string[];
}
export interface StoryReport {
  completed: boolean;
  daysCompleted: number;
  openingCashCents: number;
  closingCashCents: number;
  deltaCents: number;
  revenueCents: number;
  costCents: number;
  ledger: readonly LedgerEntry[];
  reconciled: boolean;
  freedHours: number;
  personalHours: number;
  commercialHours: number;
  baseLoaves: number;
  extraLoaves: number;
  deliveryStops: number;
  characters: Record<CharacterId, CharacterSummary>;
  narrative: readonly string[];
  assumptions: readonly string[];
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}

export const characters: readonly Character[] = freeze([
  { id: "ahe", name: "阿禾", role: "揉面与烘焙", color: "#ebac62" },
  { id: "xiaoman", name: "小满", role: "出炉与前台", color: "#9fb49a" },
]);
const ids: readonly CharacterId[] = ["ahe", "xiaoman"];
const activities: readonly Activity[] = ["rest", "delivery", "extra"];
export const constants = freeze({
  chapterTitle: "面包出炉以后",
  totalDays: 7,
  totalRounds: 4,
  initialCashCents: 50000,
  manualWorkerHoursPerDay: 8,
  machineWorkerHoursPerDay: 4,
  baseHoursPerPerson: 2,
  freedHoursPerPerson: 2,
  baseLoavesPerDay: 60,
  breadPriceCents: 600,
  ingredientsPerLoafCents: 180,
  machineOperatingCostCents: 1200,
  hourlyWageCents: 2000,
  protectedPaidHoursPerPerson: 4,
  deliveryStopsPerBlock: 6,
  deliveryFeePerStopCents: 250,
  deliveryCostPerStopCents: 50,
  extraLoavesPerBlock: 12,
  extraDemandByDay: [12, 16, 20, 12, 24, 16, 8] as readonly number[],
  deliveryDemandByDay: [8, 10, 6, 12, 8, 12, 6] as readonly number[],
});

export const assumptions: readonly string[] = freeze([
  "这是虚构的七日小镇实验，不是对真实社会或某种制度的预测。",
  "机器已由镇上购置并借给面包坊；本周不计购机、租金、税、折旧或融资。期初现金为¥500。",
  "同样的60个基础面包，原来每天共需8个工时，现在只需4个工时。阿禾、小满各做2小时基础工作，各腾出2小时。",
  "基础面包每天全部售出，每个¥6，原料每个¥1.80。机器运行费每天¥12，包含本模型中的加单耗能。",
  "工资基准是每小时¥20、每人每天4小时。保薪制每天每人¥80；按实际工时计薪时，个人时间不计薪，工作2小时为¥40、4小时为¥80。",
  "按时计薪仅在第7天、两人明确同意试行一天后可选；前6天维持既定工资。",
  "每个2小时配送班最多送6单，配送的是已计入基础销售的面包，只另收每单¥2.50配送费、支出¥0.50配送成本。",
  "每个2小时加单班含备料、包装和清洁，最多做12个额外面包。额外面包按实际需求生产并售出，无库存、赊销或浪费。",
  "每日额外订单需求依次为12、16、20、12、24、16、8个；配送需求依次为8、10、6、12、8、12、6单。未满足的需求不会累积。",
  "两人同时做同一项目时，需求在两人之间均分；有零头时按天轮换优先。需求不足时，2小时班次仍包含等待、准备和收尾，工资不减少。",
]);

const noHourly = "这几天仍按原先约定保薪；我没有同意改为按时计薪。";
export const rounds: readonly Round[] = freeze([
  {
    index: 0,
    days: [1, 2],
    title: "第一炉之后",
    subtitle: "第1—2天 · 先问问他们",
    narration:
      "机器停下时，比往常早了两小时。面包没有少，接下来的时间却还没有名字。",
    preferences: {
      ahe: {
        quote: "我想先歇一会儿。要试配送或加单，也可以跟我商量。",
        preferred: "rest",
        refused: {},
        personalActivity: "rest",
        personalDestination: "home",
        personalDetail: "在小院泡杯茶，休息两小时。",
        hourlyConsent: false,
        wageQuote: noHourly,
      },
      xiaoman: {
        quote: "这两天我不想接加单。出去送一圈，或者留点自己的时间，都可以。",
        preferred: "delivery",
        refused: { extra: "小满明确说，这两天不接加单。" },
        personalActivity: "rest",
        personalDestination: "home",
        personalDetail: "在小院翻几页闲书，休息两小时。",
        hourlyConsent: false,
        wageQuote: noHourly,
      },
    },
  },
  {
    index: 1,
    days: [3, 4],
    title: "一张课表",
    subtitle: "第3—4天 · 时间有了去处",
    narration:
      "阿禾把夜校的试课单压在面粉罐下。小满对着街区地图，画了一条新的配送路线。",
    preferences: {
      ahe: {
        quote:
          "这两天下午有烘焙课，我最想去上课。加单我能接受，但这次不跑配送。",
        preferred: "rest",
        refused: { delivery: "阿禾拒绝这两天的配送安排。" },
        personalActivity: "study",
        personalDestination: "school",
        personalDetail:
          "去社区课堂上两小时烘焙课；本周课程免费，学习不自动折算为收益。",
        hourlyConsent: false,
        wageQuote: noHourly,
      },
      xiaoman: {
        quote: "我愿意试试新路线。留店加单或休息，也都可以。",
        preferred: "delivery",
        refused: {},
        personalActivity: "rest",
        personalDestination: "home",
        personalDetail: "在小院休息，把下午留给自己。",
        hourlyConsent: false,
        wageQuote: noHourly,
      },
    },
  },
  {
    index: 2,
    days: [5, 6],
    title: "需求也有边界",
    subtitle: "第5—6天 · 订单有多大",
    narration:
      "周末的订单变多了，却也不是无限的。两个人各自说了想做和不想做的事。",
    preferences: {
      ahe: {
        quote: "这两天我不接额外烘焙了。配送可以，休息也好。",
        preferred: "rest",
        refused: { extra: "阿禾明确说，这两天不接额外烘焙。" },
        personalActivity: "rest",
        personalDestination: "home",
        personalDetail: "在小院照料花草，留出两小时自己的时间。",
        hourlyConsent: false,
        wageQuote: noHourly,
      },
      xiaoman: {
        quote: "我愿意留店做些加单。这两天不想跑配送；也可以让我去学画。",
        preferred: "extra",
        refused: { delivery: "小满拒绝这两天的配送安排。" },
        personalActivity: "study",
        personalDestination: "school",
        personalDetail:
          "去社区课堂上两小时素描课；本周课程免费，学习不自动折算为收益。",
        hourlyConsent: false,
        wageQuote: noHourly,
      },
    },
  },
  {
    index: 3,
    days: [7],
    title: "把约定写下来",
    subtitle: "第7天 · 今天之后呢",
    narration:
      "这一周快结束了。大家把账本和各自的时间放在同一张桌上，只为今天做一个明确的约定。",
    preferences: {
      ahe: {
        quote:
          "今天三种安排我都能接受，我更想留点自己的时间。工资的变化也请明明白白写出来。",
        preferred: "rest",
        refused: {},
        personalActivity: "rest",
        personalDestination: "home",
        personalDetail: "把最后一个下午留给自己，在小院休息。",
        hourlyConsent: true,
        wageQuote:
          "我同意只在第7天试行按实际工时计薪：个人时间2小时不计薪，今天收入可能从¥80降到¥40。也可以继续保薪。",
      },
      xiaoman: {
        quote:
          "今天可以接一点加单，不过也要看实际有多少人买。其他安排我也接受。",
        preferred: "extra",
        refused: {},
        personalActivity: "rest",
        personalDestination: "home",
        personalDetail: "在小院读书休息，把两小时留给自己。",
        hourlyConsent: true,
        wageQuote:
          "我同意只在第7天试行按实际工时计薪：个人时间2小时不计薪，今天收入可能从¥80降到¥40。也可以继续保薪。",
      },
    },
  },
]);
export const preferences = freeze({
  ahe: rounds.map((r) => r.preferences.ahe),
  xiaoman: rounds.map((r) => r.preferences.xiaoman),
});

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label}必须是对象`);
  return value as Record<string, unknown>;
}
function keys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void {
  if (Object.keys(value).sort().join("|") !== [...expected].sort().join("|"))
    throw new Error(`${label}包含缺失或未知字段`);
}
function normalizedPlan(value: unknown, round: Round): Plan {
  const p = object(value, "安排");
  keys(p, ["allocations", "wageMode"], "安排");
  const allocations = object(p.allocations, "个人安排");
  keys(allocations, ids, "个人安排");
  if (p.wageMode !== "protected" && p.wageMode !== "hourly")
    throw new Error("未知工资约定");
  const result: Plan = {
    allocations: { ahe: "rest", xiaoman: "rest" },
    wageMode: p.wageMode,
  };
  for (const id of ids) {
    const activity = allocations[id];
    if (!activities.includes(activity as Activity))
      throw new Error(`未知活动：${id}`);
    const refusal = round.preferences[id].refused[activity as Activity];
    if (refusal) throw new Error(refusal);
    result.allocations[id] = activity as Activity;
  }
  if (
    result.wageMode === "hourly" &&
    ids.some((id) => !round.preferences[id].hourlyConsent)
  ) {
    throw new Error("本轮两人尚未共同同意按时计薪，请维持保薪约定");
  }
  return result;
}
function samePlan(a: Plan, b: Plan): boolean {
  return (
    a.wageMode === b.wageMode &&
    ids.every((id) => a.allocations[id] === b.allocations[id])
  );
}
const trustedStates = new WeakSet<object>();
function trust(state: StoryState): StoryState {
  trustedStates.add(state);
  return freeze(state);
}
function assertState(state: StoryState): void {
  if (!state || !trustedStates.has(state))
    throw new Error("无效故事状态；请使用initialStory或decodeStory恢复检查点");
}
export function initialStory(): StoryState {
  return trust({
    version: 1,
    chapter: "bread-after-baking",
    roundIndex: 0,
    cashCents: constants.initialCashCents,
    completed: false,
    days: [],
    history: [],
  });
}
export function getRound(state: StoryState): Round | null {
  assertState(state);
  return rounds[state.roundIndex] ?? null;
}
export function availableChoices(
  state: StoryState,
  characterId: CharacterId,
): readonly Choice[] {
  assertState(state);
  if (!ids.includes(characterId)) throw new Error("未知角色");
  const round = getRound(state);
  if (!round) return [];
  const pref = round.preferences[characterId];
  return freeze(
    activities.map((id) => ({
      id,
      label:
        id === "rest"
          ? pref.personalActivity === "study"
            ? "去学习"
            : "留给自己"
          : id === "delivery"
            ? "街区配送"
            : "接受加单",
      description:
        id === "rest"
          ? pref.personalDetail
          : id === "delivery"
            ? "用2小时送最多6单；只增加配送费，面包销售不重复计入。"
            : "用2小时做最多12个额外面包；只按当天实际需求生产。",
      available: !pref.refused[id],
      reason: pref.refused[id] ?? "",
      preferred: pref.preferred === id,
    })),
  );
}
export function availableWageModes(state: StoryState): readonly WageChoice[] {
  const round = getRound(state);
  if (!round) return [];
  const hourlyAvailable = ids.every(
    (id) => round.preferences[id].hourlyConsent,
  );
  return freeze([
    {
      id: "protected",
      label: "维持原工资",
      description: "每人每天¥80；腾出的2小时用于休息、学习或工作都不减薪。",
      available: true,
      reason: "",
    },
    {
      id: "hourly",
      label: "按实际工时计薪",
      description:
        "仅第7天双方已同意试行；个人时间不计薪，休息或学习的人今天收入为¥40，继续工作的人为¥80。",
      available: hourlyAvailable,
      reason: hourlyAvailable
        ? ""
        : "本轮未取得两人的共同同意，原有保薪约定继续生效。",
    },
  ]);
}
export function defaultPlan(state: StoryState): Plan {
  const round = getRound(state);
  if (!round) throw new Error("七日故事已完成");
  return {
    allocations: {
      ahe: round.preferences.ahe.preferred,
      xiaoman: round.preferences.xiaoman.preferred,
    },
    wageMode: "protected",
  };
}

function splitDemand(
  plan: Plan,
  activity: Activity,
  demand: number,
  perBlock: number,
  day: number,
): Record<CharacterId, number> {
  const workers = ids.filter((id) => plan.allocations[id] === activity);
  const count: Record<CharacterId, number> = { ahe: 0, xiaoman: 0 };
  if (!workers.length) return count;
  const served = Math.min(demand, workers.length * perBlock);
  for (const id of workers) count[id] = Math.floor(served / workers.length);
  const priority = day % 2 === 1 ? workers : [...workers].reverse();
  for (let i = 0; i < served % workers.length; i++) count[priority[i]]++;
  return count;
}
function settleDay(
  round: Round,
  plan: Plan,
  day: number,
  openingCashCents: number,
): DaySettlement {
  const c = constants;
  const deliveryDemand = c.deliveryDemandByDay[day - 1];
  const extraDemand = c.extraDemandByDay[day - 1];
  const delivery = splitDemand(
    plan,
    "delivery",
    deliveryDemand,
    c.deliveryStopsPerBlock,
    day,
  );
  const extra = splitDemand(
    plan,
    "extra",
    extraDemand,
    c.extraLoavesPerBlock,
    day,
  );
  const ledger: LedgerEntry[] = [];
  const add = (
    category: LedgerEntry["category"],
    label: string,
    quantity: number,
    unitCents: number,
    sign: 1 | -1,
    characterId?: CharacterId,
  ) => {
    if (!Number.isSafeInteger(quantity) || !Number.isSafeInteger(unitCents))
      throw new Error("账本只接受整数");
    ledger.push({
      id: `day-${day}-${category}${characterId ? `-${characterId}` : ""}`,
      category,
      label,
      amountCents: sign * quantity * unitCents,
      quantity,
      unitCents,
      ...(characterId ? { characterId } : {}),
    });
  };
  add(
    "base_revenue",
    "60个基础面包销售",
    c.baseLoavesPerDay,
    c.breadPriceCents,
    1,
  );
  add(
    "base_ingredients",
    "基础面包原料",
    c.baseLoavesPerDay,
    c.ingredientsPerLoafCents,
    -1,
  );
  add("machine", "机器每日运行费", 1, c.machineOperatingCostCents, -1);
  const people = {} as Record<CharacterId, CharacterDay>;
  for (const character of characters) {
    const id = character.id;
    const pref = round.preferences[id];
    const activity = plan.allocations[id];
    const personalHours = activity === "rest" ? c.freedHoursPerPerson : 0;
    const workedHours =
      c.baseHoursPerPerson + (activity === "rest" ? 0 : c.freedHoursPerPerson);
    const paidHours =
      plan.wageMode === "protected"
        ? c.protectedPaidHoursPerPerson
        : workedHours;
    const wagesCents = paidHours * c.hourlyWageCents;
    add(
      "wages",
      `${character.name}工资（${paidHours}小时）`,
      paidHours,
      c.hourlyWageCents,
      -1,
      id,
    );
    if (delivery[id]) {
      add(
        "delivery_revenue",
        `${character.name}配送服务费`,
        delivery[id],
        c.deliveryFeePerStopCents,
        1,
        id,
      );
      add(
        "delivery_cost",
        `${character.name}配送成本`,
        delivery[id],
        c.deliveryCostPerStopCents,
        -1,
        id,
      );
    }
    if (extra[id]) {
      add(
        "extra_revenue",
        `${character.name}额外面包销售`,
        extra[id],
        c.breadPriceCents,
        1,
        id,
      );
      add(
        "extra_ingredients",
        `${character.name}额外面包原料`,
        extra[id],
        c.ingredientsPerLoafCents,
        -1,
        id,
      );
    }
    const wageLine =
      plan.wageMode === "protected"
        ? "今天仍拿¥80。"
        : `今天按${workedHours}个实际工时领¥${wagesCents / 100}，这是我同意的一天试行。`;
    const choiceLine =
      activity === "rest"
        ? pref.personalActivity === "study"
          ? "两小时课程上完了。学到的东西，今天先不急着变成收入。"
          : "这两小时留给了自己。"
        : activity === "delivery"
          ? `今天送了${delivery[id]}单，配送费单独记账。`
          : `今天多做了${extra[id]}个面包，按实际订单收工。`;
    const preferenceLine =
      activity === pref.preferred
        ? "这是我这轮更想做的安排。"
        : "这也是我同意的安排。";
    const actions: SceneAction[] = [
      {
        id: `day-${day}-${id}-base`,
        day,
        characterId: id,
        kind: "base",
        anchor: "bakery",
        hours: 2,
        title: "共同完成基础烘焙",
        detail: `${character.name}工作2小时；两人合计4个工时，机器辅助完成60个基础面包。`,
        breadCount: 30,
        deliveryStops: 0,
      },
      {
        id: `day-${day}-${id}-free`,
        day,
        characterId: id,
        kind: activity === "rest" ? pref.personalActivity : activity,
        anchor:
          activity === "rest"
            ? pref.personalDestination
            : activity === "delivery"
              ? "market"
              : "bakery",
        hours: 2,
        title:
          activity === "rest"
            ? pref.personalActivity === "study"
              ? "去社区课堂"
              : "留给自己的下午"
            : activity === "delivery"
              ? "街区配送"
              : "接受有限加单",
        detail:
          activity === "rest"
            ? pref.personalDetail
            : activity === "delivery"
              ? `用2小时完成${delivery[id]}单配送，含准备、路程和收尾；本日全店配送需求为${deliveryDemand}单。`
              : `用2小时完成${extra[id]}个额外面包，含备料、等待和清洁；本日全店额外需求为${extraDemand}个。`,
        breadCount: extra[id],
        deliveryStops: delivery[id],
      },
    ];
    people[id] = {
      characterId: id,
      name: character.name,
      activity,
      workedHours,
      paidHours,
      personalHours,
      wagesCents,
      deliveryStops: delivery[id],
      extraLoaves: extra[id],
      personalDestination:
        activity === "rest" ? pref.personalDestination : null,
      personalActivity: activity === "rest" ? pref.personalActivity : null,
      dialogue: `${choiceLine}${wageLine}${preferenceLine}`,
      actions,
    };
  }
  const revenueCents = ledger.reduce(
    (sum, entry) => sum + Math.max(0, entry.amountCents),
    0,
  );
  const costCents = ledger.reduce(
    (sum, entry) => sum - Math.min(0, entry.amountCents),
    0,
  );
  const deltaCents = revenueCents - costCents;
  const closingCashCents = openingCashCents + deltaCents;
  if (!Number.isSafeInteger(closingCashCents) || closingCashCents < 0)
    throw new Error("本轮安排超出可用现金");
  return {
    day,
    roundIndex: round.index,
    openingCashCents,
    closingCashCents,
    revenueCents,
    costCents,
    deltaCents,
    baseLoaves: c.baseLoavesPerDay,
    extraLoaves: extra.ahe + extra.xiaoman,
    extraDemand,
    unfilledExtraDemand: extraDemand - extra.ahe - extra.xiaoman,
    deliveryStops: delivery.ahe + delivery.xiaoman,
    deliveryDemand,
    unservedDeliveryDemand: deliveryDemand - delivery.ahe - delivery.xiaoman,
    freedHours: 4,
    ledger,
    characters: people,
    actions: [...people.ahe.actions, ...people.xiaoman.actions],
  };
}
function summarize(
  days: readonly DaySettlement[],
): Record<CharacterId, CharacterSummary> {
  const result = {} as Record<CharacterId, CharacterSummary>;
  for (const character of characters) {
    const id = character.id;
    result[id] = {
      characterId: id,
      name: character.name,
      workedHours: 0,
      paidHours: 0,
      personalHours: 0,
      restHours: 0,
      studyHours: 0,
      wagesCents: 0,
      deliveryStops: 0,
      extraLoaves: 0,
    };
    for (const day of days) {
      const p = day.characters[id];
      for (const key of [
        "workedHours",
        "paidHours",
        "personalHours",
        "wagesCents",
        "deliveryStops",
        "extraLoaves",
      ] as const)
        result[id][key] += p[key];
      if (p.personalActivity === "rest")
        result[id].restHours += p.personalHours;
      if (p.personalActivity === "study")
        result[id].studyHours += p.personalHours;
    }
  }
  return result;
}
export function previewPlan(state: StoryState, plan: Plan): Preview {
  const round = getRound(state);
  if (!round) throw new Error("七日故事已完成");
  const normalized = normalizedPlan(plan, round);
  let cash = state.cashCents;
  const days = round.days.map((day) => {
    const settled = settleDay(round, normalized, day, cash);
    cash = settled.closingCashCents;
    return settled;
  });
  return freeze({
    roundIndex: round.index,
    plan: normalized,
    beforeCashCents: state.cashCents,
    afterCashCents: cash,
    deltaCents: cash - state.cashCents,
    days,
    characters: summarize(days),
    dialogue: {
      ahe: days[days.length - 1].characters.ahe.dialogue,
      xiaoman: days[days.length - 1].characters.xiaoman.dialogue,
    },
    notes: [
      "预演不会推进日期或更改现金；确认之后才会结算。",
      normalized.wageMode === "protected"
        ? "这轮保持每人每天¥80工资。"
        : "仅今天两人共同同意按实际工时计薪；选择个人时间者今天收入为¥40。",
      "收入、个人时间和未满足的需求分别记录，不给这次选择打道德分数。",
    ],
  });
}
export function confirmPlan(
  state: StoryState,
  plan: Plan,
  expectedRound: number,
): StoryState {
  assertState(state);
  if (
    !Number.isInteger(expectedRound) ||
    expectedRound < 0 ||
    expectedRound >= rounds.length
  )
    throw new Error("无效的检查点编号");
  const normalized = normalizedPlan(plan, rounds[expectedRound]);
  if (expectedRound < state.roundIndex) {
    if (samePlan(state.history[expectedRound].plan, normalized)) return state;
    throw new Error("该轮已结算，不能用另一份安排再次确认");
  }
  if (expectedRound !== state.roundIndex)
    throw new Error("检查点已变化，请重新预演当前一轮");
  const preview = previewPlan(state, normalized);
  const history: Checkpoint[] = [
    ...state.history,
    {
      roundIndex: expectedRound,
      plan: normalized,
      dayNumbers: preview.days.map((day) => day.day),
      openingCashCents: state.cashCents,
      closingCashCents: preview.afterCashCents,
    },
  ];
  const roundIndex = state.roundIndex + 1;
  return trust({
    version: 1,
    chapter: "bread-after-baking",
    roundIndex,
    cashCents: preview.afterCashCents,
    completed: roundIndex === rounds.length,
    days: [...state.days, ...preview.days],
    history,
  });
}
/** Replaying a completed prefix never changes the supplied story. */
export function replayCheckpoint(
  state: StoryState,
  checkpointCount: number,
): StoryState {
  assertState(state);
  if (
    !Number.isInteger(checkpointCount) ||
    checkpointCount < 0 ||
    checkpointCount > state.history.length
  )
    throw new Error("无效的回看检查点");
  let replay = initialStory();
  for (const checkpoint of state.history.slice(0, checkpointCount))
    replay = confirmPlan(replay, checkpoint.plan, checkpoint.roundIndex);
  return replay;
}
export function encodeStory(state: StoryState): string {
  assertState(state);
  return JSON.stringify({
    version: 1,
    chapter: "bread-after-baking",
    checkpoints: state.history.map((checkpoint) => ({
      roundIndex: checkpoint.roundIndex,
      plan: checkpoint.plan,
    })),
  });
}
export function decodeStory(serialized: string): StoryState {
  if (typeof serialized !== "string" || serialized.length > 20000)
    throw new Error("存档无效或过大");
  let raw: unknown;
  try {
    raw = JSON.parse(serialized);
  } catch {
    throw new Error("存档不是有效JSON");
  }
  const save = object(raw, "存档");
  keys(save, ["version", "chapter", "checkpoints"], "存档");
  if (save.version !== 1 || save.chapter !== "bread-after-baking")
    throw new Error("不支持的存档版本或章节");
  if (
    !Array.isArray(save.checkpoints) ||
    save.checkpoints.length > rounds.length
  )
    throw new Error("存档检查点数量无效");
  let state = initialStory();
  for (let index = 0; index < save.checkpoints.length; index++) {
    const checkpoint = object(save.checkpoints[index], "检查点");
    keys(checkpoint, ["roundIndex", "plan"], "检查点");
    if (checkpoint.roundIndex !== index)
      throw new Error("存档检查点必须从第一轮连续排列");
    const plan = normalizedPlan(checkpoint.plan, rounds[index]);
    state = confirmPlan(state, plan, index);
  }
  return state;
}
export const encode = encodeStory;
export const decode = decodeStory;
export function report(state: StoryState): StoryReport {
  assertState(state);
  const people = summarize(state.days);
  const ledger = state.days.flatMap((day) => day.ledger);
  const revenueCents = ledger.reduce(
    (sum, entry) => sum + Math.max(0, entry.amountCents),
    0,
  );
  const costCents = ledger.reduce(
    (sum, entry) => sum - Math.min(0, entry.amountCents),
    0,
  );
  const personalHours = people.ahe.personalHours + people.xiaoman.personalHours;
  const freedHours = state.days.length * 4;
  const sum = (key: "baseLoaves" | "extraLoaves" | "deliveryStops") =>
    state.days.reduce((total, day) => total + day[key], 0);
  return freeze({
    completed: state.completed,
    daysCompleted: state.days.length,
    openingCashCents: constants.initialCashCents,
    closingCashCents: state.cashCents,
    deltaCents: state.cashCents - constants.initialCashCents,
    revenueCents,
    costCents,
    ledger,
    reconciled:
      constants.initialCashCents + revenueCents - costCents ===
        state.cashCents &&
      state.days.every(
        (day) =>
          day.openingCashCents + day.revenueCents - day.costCents ===
          day.closingCashCents,
      ),
    freedHours,
    personalHours,
    commercialHours: freedHours - personalHours,
    baseLoaves: sum("baseLoaves"),
    extraLoaves: sum("extraLoaves"),
    deliveryStops: sum("deliveryStops"),
    characters: people,
    narrative: [
      `已度过${state.days.length}天，机器共腾出${freedHours}个工时。其中${personalHours}小时留给个人，${freedHours - personalHours}小时用于配送或加单。`,
      `阿禾有${people.ahe.personalHours}小时个人时间（学习${people.ahe.studyHours}小时），收入¥${(people.ahe.wagesCents / 100).toFixed(2)}；小满有${people.xiaoman.personalHours}小时个人时间（学习${people.xiaoman.studyHours}小时），收入¥${(people.xiaoman.wagesCents / 100).toFixed(2)}。`,
      `面包坊现金从¥500.00变为¥${(state.cashCents / 100).toFixed(2)}。这是本模型下的现金结余，不包含购机或其他长期成本。`,
      "账本记录了钱，日程记录了时间；他们各自同意了什么，也留在了这周的故事里。",
    ],
    assumptions,
  });
}
