export type Cell = [number, number];
export type Item = "grain" | "bread";
export type Inventory = Record<Item, number>;
export type FacilityId = "store" | "oven" | "table";
export type WorkerId = "ahe" | "xiaoman";
export type Layout = Record<FacilityId, Cell>;
export type Task = {
  kind: "pickup" | "deliver" | "process" | "eat";
  facility: FacilityId;
  item: Item;
  amount: number;
  remaining: number;
  started: boolean;
  reserved: Inventory;
  explanation: string;
};
export type Worker = {
  id: WorkerId;
  position: Cell;
  next: Cell | null;
  cargo: Inventory;
  hunger: number;
  task: Task | null;
  reason: string;
  meals: number;
  walked: number;
  walkingSeconds: number;
  workSeconds: number;
  waitingSeconds: number;
  eatingSeconds: number;
  hungrySeconds: number;
};
export type Experiment = {
  version: 1;
  tick: number;
  paused: boolean;
  layout: Layout;
  stocks: Record<FacilityId, Inventory>;
  batch: { owner: WorkerId; inputs: Inventory } | null;
  energy: number;
  energyUsed: number;
  produced: number;
  workers: Worker[];
  events: { tick: number; text: string }[];
};
export const rules = {
  width: 9,
  height: 7,
  tickSeconds: 0.25,
  initialMaterial: 24,
  initialEnergy: 16,
  capacity: 2,
  emptySpeed: 1.2,
  loadedSpeed: 0.8,
  hungerPerSecond: 0.24,
  hungerPerStep: 0.08,
  mealThreshold: 60,
  mealRelief: 42,
  handlingSeconds: 1,
  eatingSeconds: 2,
} as const;
// Quantities are prepared ingredient portions, not a chemical/mass model.
// Recipes declare material, energy and time separately; transport only transfers.
export const recipes = {
  bread: {
    inputs: { grain: 2, bread: 0 },
    outputs: { grain: 0, bread: 2 },
    seconds: 6,
    energy: 2,
  },
} as const;
export const defaultLayout: Layout = {
  store: [1, 1],
  oven: [7, 1],
  table: [7, 5],
};
export const names = { ahe: "阿禾", xiaoman: "小满" };
export const facilityNames = { store: "仓库", oven: "烤炉", table: "餐桌" };
export const walls: Cell[] = [
  [4, 1],
  [4, 2],
  [4, 3],
  [4, 4],
  [4, 5],
];
const empty = (): Inventory => ({ grain: 0, bread: 0 });
const ids: FacilityId[] = ["store", "oven", "table"];
const same = (a: Cell, b: Cell) =>
  Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) < 1e-8;
export const load = (w: Worker) =>
  w.cargo.grain +
  w.cargo.bread +
  (w.task?.reserved.grain ?? 0) +
  (w.task?.reserved.bread ?? 0);
export const seconds = (s: Experiment) => s.tick * rules.tickSeconds;
export function inBounds(p: Cell) {
  return (
    p.every(Number.isInteger) &&
    p[0] >= 0 &&
    p[0] < rules.width &&
    p[1] >= 0 &&
    p[1] < rules.height
  );
}
export function blocked(layout: Layout, p: Cell) {
  return (
    !inBounds(p) ||
    walls.some((w) => same(w, p)) ||
    ids.some((id) => same(layout[id], p))
  );
}
function neighbors(p: Cell): Cell[] {
  return [
    [p[0] + 1, p[1]],
    [p[0], p[1] + 1],
    [p[0] - 1, p[1]],
    [p[0], p[1] - 1],
  ];
}
function adjacent(p: Cell, destination: Cell) {
  return (
    p.every(Number.isInteger) &&
    Math.abs(p[0] - destination[0]) + Math.abs(p[1] - destination[1]) === 1
  );
}
/** Shortest orthogonal path to an accessible side of a facility. */
export function route(
  layout: Layout,
  from: Cell,
  destination: FacilityId,
): Cell[] | null {
  if (!from.every(Number.isInteger) || blocked(layout, from)) return null;
  const queue: Cell[][] = [[from]],
    visited = new Set([from.join(",")]);
  while (queue.length) {
    const path = queue.shift()!,
      tail = path[path.length - 1];
    if (adjacent(tail, layout[destination])) return path;
    for (const next of neighbors(tail)) {
      const key = next.join(",");
      if (!blocked(layout, next) && !visited.has(key)) {
        visited.add(key);
        queue.push([...path, next]);
      }
    }
  }
  return null;
}
export function facilityDistance(
  layout: Layout,
  from: FacilityId,
  to: FacilityId,
): number | null {
  const lengths = neighbors(layout[from])
    .filter((p) => !blocked(layout, p))
    .map((p) => route(layout, p, to))
    .filter((p) => p !== null)
    .map((p) => p!.length - 1);
  return lengths.length ? Math.min(...lengths) : null;
}
export function initialExperiment(layout: Layout = defaultLayout): Experiment {
  const copied = structuredClone(layout);
  for (const id of ids) {
    if (
      !inBounds(copied[id]) ||
      walls.some((p) => same(p, copied[id])) ||
      ids.some((other) => other !== id && same(copied[id], copied[other]))
    )
      throw new Error("设施不能重叠或越界");
  }
  const floor: Cell[] = [];
  for (let y = 0; y < rules.height; y++)
    for (let x = 0; x < rules.width; x++)
      if (!blocked(copied, [x, y])) floor.push([x, y]);
  const worker = (id: WorkerId, near: Cell): Worker => {
    const position = [...floor].sort(
      (a, b) =>
        Math.hypot(a[0] - near[0], a[1] - near[1]) -
        Math.hypot(b[0] - near[0], b[1] - near[1]),
    )[0];
    return {
      id,
      position: [...position],
      next: null,
      cargo: empty(),
      hunger: 48,
      task: null,
      reason: "等你开始观察",
      meals: 0,
      walked: 0,
      walkingSeconds: 0,
      workSeconds: 0,
      waitingSeconds: 0,
      eatingSeconds: 0,
      hungrySeconds: 0,
    };
  };
  return {
    version: 1,
    tick: 0,
    paused: true,
    layout: copied,
    stocks: {
      store: { grain: rules.initialMaterial, bread: 0 },
      oven: empty(),
      table: empty(),
    },
    batch: null,
    energy: rules.initialEnergy,
    energyUsed: 0,
    produced: 0,
    workers: [worker("ahe", [1, 5]), worker("xiaoman", [2, 5])],
    events: [],
  };
}
function event(s: Experiment, text: string) {
  s.events.push({ tick: s.tick, text });
  if (s.events.length > 24) s.events.shift();
}
function task(
  w: Worker,
  kind: Task["kind"],
  facility: FacilityId,
  item: Item,
  amount: number,
  reason: string,
) {
  w.reason = reason;
  w.task = {
    kind,
    facility,
    item,
    amount,
    remaining:
      kind === "process"
        ? recipes.bread.seconds
        : kind === "eat"
          ? rules.eatingSeconds
          : rules.handlingSeconds,
    started: false,
    reserved: empty(),
    explanation: reason,
  };
}
function reachable(s: Experiment, w: Worker, facility: FacilityId) {
  return route(s.layout, w.position, facility) !== null;
}
function decide(s: Experiment, w: Worker) {
  if (w.cargo.bread)
    return task(
      w,
      "deliver",
      "table",
      "bread",
      w.cargo.bread,
      `背着 ${w.cargo.bread} 个面包，先送到餐桌`,
    );
  if (w.cargo.grain)
    return task(
      w,
      "deliver",
      "oven",
      "grain",
      w.cargo.grain,
      `背着 ${w.cargo.grain} 份原料，先送到烤炉`,
    );
  if (
    w.hunger >= rules.mealThreshold &&
    s.stocks.table.bread &&
    reachable(s, w, "table")
  )
    return task(
      w,
      "eat",
      "table",
      "bread",
      1,
      `饥饿 ${Math.round(w.hunger)}%，餐桌有面包，先吃饭`,
    );
  if (s.stocks.oven.bread && reachable(s, w, "oven"))
    return task(
      w,
      "pickup",
      "oven",
      "bread",
      Math.min(2, s.stocks.oven.bread),
      "烤炉有成品，优先把面包送上餐桌",
    );
  if (
    !s.batch &&
    s.stocks.oven.grain >= 2 &&
    s.energy >= 2 &&
    reachable(s, w, "oven")
  )
    return task(
      w,
      "process",
      "oven",
      "grain",
      2,
      "烤炉有 2 份原料和 2 单位电能，做一炉面包",
    );
  if (
    s.stocks.store.grain &&
    s.stocks.oven.grain < 6 &&
    s.energy >= 2 &&
    reachable(s, w, "store") &&
    reachable(s, w, "oven")
  )
    return task(
      w,
      "pickup",
      "store",
      "grain",
      Math.min(2, s.stocks.store.grain),
      `烤炉原料 ${s.stocks.oven.grain} 份不足备料量，去仓库搬一趟（最多 2 份）`,
    );
  if (w.hunger >= rules.mealThreshold && s.stocks.table.bread)
    w.reason = "餐桌有面包，但通路被挡住了";
  else if (s.batch) w.reason = `${names[s.batch.owner]} 正在烘烤，等成品再搬运`;
  else if (s.energy < 2 && s.stocks.oven.bread === 0)
    w.reason = "电能不足一炉；剩余原料不会凭空变成面包";
  else if (s.stocks.store.grain || s.stocks.oven.grain || s.stocks.oven.bread)
    w.reason = "通路被挡，无法完成供给；试着移开设施";
  else if (s.stocks.table.bread && w.hunger < 60)
    w.reason = "食物已送到；现在不饿，稍后再吃";
  else w.reason = "原料已用完，等你重置或调整实验";
}
function begin(s: Experiment, w: Worker, t: Task) {
  if (t.kind === "pickup") {
    const amount = Math.min(
      t.amount,
      s.stocks[t.facility][t.item],
      rules.capacity - load(w),
    );
    if (!amount) return false;
    t.amount = amount;
    s.stocks[t.facility][t.item] -= amount;
    t.reserved[t.item] = amount;
  } else if (t.kind === "eat") {
    if (!s.stocks.table.bread) return false;
    s.stocks.table.bread--;
    t.reserved.bread = 1;
  } else if (t.kind === "process") {
    if (
      s.batch ||
      s.energy < recipes.bread.energy ||
      s.stocks.oven.grain < recipes.bread.inputs.grain
    )
      return false;
    s.stocks.oven.grain -= recipes.bread.inputs.grain;
    s.energy -= recipes.bread.energy;
    s.energyUsed += recipes.bread.energy;
    s.batch = { owner: w.id, inputs: { ...recipes.bread.inputs } };
    event(s, `${names[w.id]} 投入 2 份原料 + 2 单位电能，烘烤需 6 秒`);
  } else if (w.cargo[t.item] < t.amount) return false;
  t.started = true;
  return true;
}
function finish(s: Experiment, w: Worker, t: Task) {
  if (t.kind === "pickup") w.cargo[t.item] += t.reserved[t.item];
  else if (t.kind === "deliver") {
    w.cargo[t.item] -= t.amount;
    s.stocks[t.facility][t.item] += t.amount;
    event(
      s,
      `${names[w.id]} 把 ${t.amount} ${t.item === "grain" ? "份原料" : "个面包"} 送到${facilityNames[t.facility]}`,
    );
  } else if (t.kind === "process") {
    s.stocks.oven.bread += recipes.bread.outputs.bread;
    s.produced += recipes.bread.outputs.bread;
    s.batch = null;
    event(s, "一炉完成：2 份原料成为 2 个面包");
  } else {
    w.hunger = Math.max(0, w.hunger - rules.mealRelief);
    w.meals++;
    event(s, `${names[w.id]} 吃了 1 个面包，饥饿降低 42%`);
  }
  w.task = null;
}
function stepWorker(s: Experiment, w: Worker) {
  const dt = rules.tickSeconds;
  w.hunger = Math.min(100, w.hunger + rules.hungerPerSecond * dt);
  if (w.hunger >= 85) w.hungrySeconds += dt;
  let budget: number = dt;
  while (budget > 1e-9) {
    if (!w.task) decide(s, w);
    const t = w.task;
    if (!t) {
      w.waitingSeconds += budget;
      return;
    }
    if (!w.next && !adjacent(w.position, s.layout[t.facility])) {
      const path = route(s.layout, w.position, t.facility);
      if (!path || path.length < 2) {
        w.reason = `通路被挡，无法到达${facilityNames[t.facility]}；货物与进度仍在`;
        w.waitingSeconds += budget;
        return;
      }
      w.next = path[1];
    }
    w.reason = t.explanation;
    if (w.next) {
      const dx = w.next[0] - w.position[0],
        dy = w.next[1] - w.position[1];
      const distance = Math.hypot(dx, dy);
      const speed = load(w) ? rules.loadedSpeed : rules.emptySpeed;
      const moved = Math.min(distance, speed * budget),
        elapsed = moved / speed;
      if (distance > 0) {
        w.position[0] += (dx / distance) * moved;
        w.position[1] += (dy / distance) * moved;
      }
      w.walked += moved;
      w.walkingSeconds += elapsed;
      w.hunger = Math.min(
        100,
        w.hunger + moved * rules.hungerPerStep * (1 + load(w) / 2),
      );
      budget = Math.max(0, budget - elapsed);
      if (distance - moved < 1e-8) {
        w.position = [...w.next];
        w.next = null;
      } else return;
      continue;
    }
    if (!t.started && !begin(s, w, t)) {
      w.task = null;
      w.reason = "刚才的物品已被另一人取走；重新判断";
      w.waitingSeconds += budget;
      return;
    }
    const elapsed = Math.min(t.remaining, budget);
    t.remaining = Math.max(0, t.remaining - elapsed);
    budget = Math.max(0, budget - elapsed);
    if (t.kind === "eat") w.eatingSeconds += elapsed;
    else w.workSeconds += elapsed;
    if (t.remaining < 1e-9) finish(s, w, t);
  }
}
/** Fixed-step engine, independent of render frames. Paused worlds never tick. */
export function advance(s: Experiment, duration: number): Experiment {
  if (
    !Number.isFinite(duration) ||
    duration < 0 ||
    duration > 60 ||
    !Number.isInteger(duration / rules.tickSeconds)
  )
    throw new Error("观察时长须为 0.25 秒的倍数，且不超过 60 秒");
  if (s.paused || duration === 0) return s;
  const next = structuredClone(s);
  for (let i = 0; i < duration / rules.tickSeconds; i++) {
    next.tick++;
    for (const worker of next.workers) stepWorker(next, worker);
  }
  return next;
}
export function observe(s: Experiment, duration = 10) {
  if (!s.paused) throw new Error("先暂停，再逐段观察");
  return { ...advance({ ...s, paused: false }, duration), paused: true };
}
export function moveFacility(
  s: Experiment,
  id: FacilityId,
  cell: Cell,
): Experiment {
  if (!ids.includes(id) || !inBounds(cell)) throw new Error("请选择界内的地格");
  if (walls.some((p) => same(p, cell))) throw new Error("这里是固定隔墙");
  if (ids.some((other) => other !== id && same(s.layout[other], cell)))
    throw new Error("这里已有另一处设施");
  if (
    s.workers.some(
      (w) =>
        same(w.position, cell) ||
        (w.next && same(w.next, cell)) ||
        Math.abs(w.position[0] - cell[0]) + Math.abs(w.position[1] - cell[1]) <
          1,
    )
  )
    throw new Error("这格有人正在经过，先换一个空地格");
  const next = structuredClone(s);
  next.paused = true;
  next.layout[id] = [...cell];
  for (const w of next.workers)
    w.reason = w.task?.explanation ?? "布局已调整，继续后重新判断";
  event(
    next,
    `${facilityNames[id]} 移到 (${cell[0] + 1}, ${cell[1] + 1})；已暂停，任务将重新寻路`,
  );
  return next;
}
export function directionalCell(
  cell: Cell,
  direction: "up" | "right" | "down" | "left",
): Cell {
  const offset = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] }[
    direction
  ];
  return [cell[0] + offset[0], cell[1] + offset[1]];
}
export function accounting(s: Experiment) {
  const onSites = ids.reduce(
    (n, id) => n + s.stocks[id].grain + s.stocks[id].bread,
    0,
  );
  const held = s.workers.reduce((n, w) => n + load(w), 0);
  const inProcess = s.batch ? s.batch.inputs.grain + s.batch.inputs.bread : 0;
  const eaten = s.workers.reduce((n, w) => n + w.meals, 0);
  return {
    onSites,
    held,
    inProcess,
    eaten,
    total: onSites + held + inProcess + eaten,
    energy: s.energy,
    energyUsed: s.energyUsed,
  };
}
export function bottleneck(s: Experiment): string {
  if (
    s.workers.some((w) =>
      w.task
        ? route(s.layout, w.next ?? w.position, w.task.facility) === null
        : w.reason.includes("通路被挡"),
    )
  )
    return "通路被挡：移开隔墙缺口附近的设施";
  if (
    s.energy < 2 &&
    s.stocks.store.grain + s.stocks.oven.grain > 0 &&
    !s.batch
  )
    return "电能不足：还有原料，烤炉却无法开工";
  if (s.workers.some((w) => w.hunger >= 60) && !s.stocks.table.bread)
    return "有人饿了，餐桌还没食物：查看原料、烘烤和搬运在哪一段";
  if (s.batch) return "正在烘烤：有原料也需要真实加工时间";
  if (s.stocks.oven.bread) return "成品等搬运：烤炉出炉不等于餐桌有饭";
  if (!s.stocks.store.grain && !s.stocks.oven.grain && !s.batch)
    return "原料耗尽：这次有限供给实验接近结束";
  return "原料在路上：距离和每趟负载决定供给节奏";
}
/** Validate saves as untrusted data, including mid-route and reserved materials. */
export function validate(s: Experiment) {
  if (
    !s ||
    s.version !== 1 ||
    !Number.isSafeInteger(s.tick) ||
    s.tick < 0 ||
    s.tick > 1000000 ||
    typeof s.paused !== "boolean"
  )
    throw new Error("存档版本或时间无效");
  const integer = (n: number) => Number.isSafeInteger(n) && n >= 0;
  const inventory = (v: Inventory) => v && integer(v.grain) && integer(v.bread);
  const finite = (n: number) => Number.isFinite(n) && n >= 0;
  for (const id of ids) {
    const p = s.layout[id];
    if (
      !Array.isArray(p) ||
      p.length !== 2 ||
      !inBounds(p) ||
      walls.some((w) => same(w, p)) ||
      ids.some((other) => other !== id && same(p, s.layout[other])) ||
      !inventory(s.stocks[id])
    )
      throw new Error("存档布局或物品无效");
  }
  if (
    !Array.isArray(s.workers) ||
    s.workers.length !== 2 ||
    s.workers[0].id !== "ahe" ||
    s.workers[1].id !== "xiaoman"
  )
    throw new Error("存档人物无效");
  for (const w of s.workers) {
    const p = w.position;
    if (
      !Array.isArray(p) ||
      p.length !== 2 ||
      !p.every(Number.isFinite) ||
      p[0] < 0 ||
      p[0] >= rules.width ||
      p[1] < 0 ||
      p[1] >= rules.height ||
      !inventory(w.cargo) ||
      load(w) > 2 ||
      !finite(w.hunger) ||
      w.hunger > 100 ||
      !integer(w.meals) ||
      typeof w.reason !== "string" ||
      w.reason.length > 200
    )
      throw new Error("存档人物状态无效");
    for (const metric of [
      w.walked,
      w.walkingSeconds,
      w.workSeconds,
      w.waitingSeconds,
      w.eatingSeconds,
      w.hungrySeconds,
    ])
      if (!finite(metric)) throw new Error("存档计时无效");
    if (w.next) {
      if (
        !Array.isArray(w.next) ||
        w.next.length !== 2 ||
        blocked(s.layout, w.next) ||
        !(
          (Math.abs(p[0] - w.next[0]) < 1e-8 ||
            Math.abs(p[1] - w.next[1]) < 1e-8) &&
          Math.abs(p[0] - w.next[0]) + Math.abs(p[1] - w.next[1]) <= 1
        )
      )
        throw new Error("存档路径无效");
      const endpoints: Cell[] = [
        [Math.floor(p[0] + 1e-8), Math.floor(p[1] + 1e-8)],
        [Math.ceil(p[0] - 1e-8), Math.ceil(p[1] - 1e-8)],
      ];
      if (endpoints.some((cell) => blocked(s.layout, cell)))
        throw new Error("存档路径穿过障碍");
    } else if (!p.every(Number.isInteger) || blocked(s.layout, p))
      throw new Error("存档人物站位无效");
    if (w.task) {
      const t = w.task;
      const maximum =
        t.kind === "process"
          ? recipes.bread.seconds
          : t.kind === "eat"
            ? rules.eatingSeconds
            : rules.handlingSeconds;
      if (
        !["pickup", "deliver", "process", "eat"].includes(t.kind) ||
        !ids.includes(t.facility) ||
        !["grain", "bread"].includes(t.item) ||
        !integer(t.amount) ||
        t.amount < 1 ||
        t.amount > 2 ||
        !finite(t.remaining) ||
        t.remaining <= 0 ||
        t.remaining > maximum ||
        typeof t.started !== "boolean" ||
        (!t.started && t.remaining !== maximum) ||
        typeof t.explanation !== "string" ||
        t.explanation.length > 200 ||
        !inventory(t.reserved)
      )
        throw new Error("存档任务无效");
      const expected =
        t.kind === "process"
          ? ["oven", "grain", 2]
          : t.kind === "eat"
            ? ["table", "bread", 1]
            : t.kind === "deliver"
              ? [t.item === "grain" ? "oven" : "table", t.item, t.amount]
              : [t.item === "grain" ? "store" : "oven", t.item, t.amount];
      if (
        t.facility !== expected[0] ||
        t.item !== expected[1] ||
        t.amount !== expected[2]
      )
        throw new Error("存档任务目标无效");
      const reserved = t.reserved.grain + t.reserved.bread;
      if (
        t.started && (t.kind === "pickup" || t.kind === "eat")
          ? reserved !== t.amount || t.reserved[t.item] !== t.amount
          : reserved !== 0
      )
        throw new Error("存档预留物品无效");
      if (t.kind === "deliver" && w.cargo[t.item] < t.amount)
        throw new Error("存档缺少携带物品");
      if (t.kind === "process" && t.started && s.batch?.owner !== w.id)
        throw new Error("存档加工批次无效");
    }
  }
  if (s.batch) {
    if (
      !inventory(s.batch.inputs) ||
      s.batch.inputs.grain !== 2 ||
      s.batch.inputs.bread !== 0 ||
      !s.workers.some(
        (w) =>
          w.id === s.batch!.owner &&
          w.task?.kind === "process" &&
          w.task.started,
      )
    )
      throw new Error("存档在制品无效");
  }
  const grain =
    ids.reduce((n, id) => n + s.stocks[id].grain, 0) +
    s.workers.reduce(
      (n, w) => n + w.cargo.grain + (w.task?.reserved.grain ?? 0),
      0,
    ) +
    (s.batch?.inputs.grain ?? 0);
  const bread =
    ids.reduce((n, id) => n + s.stocks[id].bread, 0) +
    s.workers.reduce(
      (n, w) => n + w.cargo.bread + (w.task?.reserved.bread ?? 0) + w.meals,
      0,
    );
  if (
    !integer(s.energy) ||
    !integer(s.energyUsed) ||
    s.energy + s.energyUsed !== rules.initialEnergy ||
    s.energyUsed % 2 !== 0 ||
    !integer(s.produced) ||
    s.produced % 2 !== 0 ||
    s.produced > 24 ||
    s.produced + (s.batch ? 2 : 0) !== s.energyUsed ||
    accounting(s).total !== 24 ||
    grain !== 24 - s.produced ||
    bread !== s.produced ||
    !Array.isArray(s.events) ||
    s.events.length > 24 ||
    s.events.some(
      (e) =>
        !integer(e.tick) ||
        e.tick > s.tick ||
        typeof e.text !== "string" ||
        e.text.length > 200,
    )
  )
    throw new Error("存档资源账目无效");
  return s;
}
export function encodeExperiment(s: Experiment) {
  validate(s);
  return JSON.stringify(s);
}
export function decodeExperiment(raw: string): Experiment {
  if (raw.length > 30000) throw new Error("存档过大");
  return validate(JSON.parse(raw) as Experiment);
}
