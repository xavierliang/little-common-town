import {
  createTown,
  applyCommand,
  stepTown,
  metrics,
  validateState,
  type TownState,
} from "./sim";
export type Action = "aid" | "jobs" | "automation" | "sharing" | "reserve";
export interface Game {
  town: TownState;
  actionsLeft: number;
  actionsToday: Action[];
  meals: number;
  shifts: number;
  reports: {
    day: number;
    meals: number;
    shifts: number;
    cash: number;
    hungry: string[];
  }[];
}
export const GOALS = { days: 7, meals: 100, shifts: 40, reserve: 400 };
export function newGame(): Game {
  return {
    town: applyCommand(
      createTown("little-common-challenge-01", "challenge"),
      { type: "setPolicy", policy: { ubiCents: 0, incomeTaxRate: 20 } },
      { type: "mayor" },
    ),
    actionsLeft: 2,
    actionsToday: [],
    meals: 0,
    shifts: 0,
    reports: [],
  };
}
export function act(
  game: Game,
  action: Action,
  residentId?: string,
  firmId?: string,
): Game {
  if (game.town.day >= GOALS.days) throw Error("本轮已结束，请重新开始");
  if (game.actionsLeft <= 0) throw Error("今天的两次行动已用完，请结算今天");
  if (game.actionsToday.includes(action) && action !== "aid")
    throw Error("这项行动今天已经执行");
  let town = game.town;
  const role = { type: "mayor" } as const;
  if (action === "aid") {
    if (!residentId) throw Error("请先选一位居民");
    town = applyCommand(town, { type: "grantAid", residentId }, role);
  } else if (action === "jobs") {
    const f =
      (firmId ? town.firms.find((f) => f.id === firmId) : undefined) ??
      [...town.firms].sort(
        (a, b) =>
          town.accounts[a.accountId].balanceCents -
          town.accounts[b.accountId].balanceCents,
      )[0];
    town = applyCommand(town, { type: "fundFirm", firmId: f.id }, role);
  } else if (action === "automation")
    town = applyCommand(town, { type: "investAutomation" }, role);
  else if (action === "sharing")
    town = applyCommand(
      town,
      { type: "setPolicy", policy: { ubiCents: 70 } },
      role,
    );
  else if (action === "reserve")
    town = applyCommand(
      town,
      { type: "setPolicy", policy: { ubiCents: 0 } },
      role,
    );
  else throw Error("未知行动");
  return {
    ...game,
    town,
    actionsLeft: game.actionsLeft - 1,
    actionsToday: [...game.actionsToday, action],
  };
}
export function nextDay(game: Game): Game {
  if (game.town.day >= GOALS.days) throw Error("本轮已结束");
  const town = stepTown(game.town),
    m = metrics(town);
  return {
    ...game,
    town,
    actionsLeft: 2,
    actionsToday: [],
    meals: game.meals + m.consumedToday,
    shifts: game.shifts + m.employed,
    reports: [
      ...game.reports,
      {
        day: town.day,
        meals: m.consumedToday,
        shifts: m.employed,
        cash: m.treasuryCents,
        hungry: missedMealsOnDay(town, town.day),
      },
    ],
  };
}
export function goals(game: Game) {
  return {
    food: game.meals >= GOALS.meals,
    work: game.shifts >= GOALS.shifts,
    reserve: metrics(game.town).treasuryCents >= GOALS.reserve,
  };
}
export function recommendation(game: Game): string {
  const town = game.town,
    m = metrics(town);
  if (town.day === 0)
    return "第一天：两家企业各只有 ¥8 周转金。先试一次「支持招聘」，再结算今天。";
  if (
    town.residents.some(
      (r) => town.accounts[r.accountId].balanceCents < 120 && r.food === 0,
    )
  )
    return "有居民买不起下一餐：点击他的头像发放定向救助，或开启普惠补助。";
  if (m.treasuryCents < 1200)
    return "财政余额不足 ¥12：普惠补助每天最多花 ¥11.20。考虑暂停，保留应急金。";
  if (town.policy.aiProductivity > 1)
    return "自动化已提高每名工人的产量。注意岗位可能减少；检查今日班次和居民买饭的钱。";
  return "观察谁缺钱、企业能否发工资，再决定把有限预算花在哪里。";
}

export function encodeGame(game: Game): string {
  return JSON.stringify({ version: 1, game });
}
export function decodeGame(raw: string): Game {
  if (typeof raw !== "string" || raw.length > 5000000) throw Error("存档无效");
  const data = JSON.parse(raw);
  if (data.version !== 1 || !data.game) throw Error("存档版本不支持");
  const game = data.game as Game;
  if (
    validateState(game.town).length ||
    game.town.scenario !== "challenge" ||
    game.town.day > 7
  )
    throw Error("挑战状态无效");
  if (
    !Array.isArray(game.actionsToday) ||
    !Number.isInteger(game.actionsLeft) ||
    game.actionsLeft < 0 ||
    game.actionsLeft > 2 ||
    game.actionsLeft + game.actionsToday.length !== 2 ||
    game.actionsToday.some(
      (a) => !["aid", "jobs", "automation", "sharing", "reserve"].includes(a),
    )
  )
    throw Error("行动次数无效");
  if (
    !Array.isArray(game.reports) ||
    game.reports.length !== game.town.day ||
    game.meals !== game.town.totalConsumed ||
    game.shifts !== game.town.history.reduce((n, h) => n + h.employed, 0)
  )
    throw Error("进度无效");
  game.reports = game.reports.map((r) => ({
    ...r,
    hungry: missedMealsOnDay(game.town, r.day),
  }));
  return game;
}

/** Replay the food ledger to identify this day's missed meals, not lingering hunger. */
export function missedMealsOnDay(town: TownState, day: number): string[] {
  if (day < 1) return [];
  const food = Object.fromEntries(town.residents.map((r) => [r.id, 1]));
  let missed: string[] = [];
  for (let d = 0; d <= day; d++) {
    for (const e of town.ledger) {
      if (e.day !== d || e.kind !== "purchase") continue;
      const resident = town.residents.find((r) => r.accountId === e.from),
        firm = town.firms.find((f) => f.accountId === e.to);
      if (resident && firm)
        food[resident.id] += e.amountCents / firm.priceCents;
    }
    if (d === 0) continue;
    missed = [];
    for (const r of town.residents) {
      if (food[r.id] >= 1) food[r.id]--;
      else missed.push(r.name);
    }
  }
  return missed;
}
export function turnInstruction(game: Game): string {
  return game.town.day >= 7
    ? "本轮已结束，可以查看结果或从同一起点再试。"
    : `准备第 ${game.town.day + 1} 天，还可行动 ${game.actionsLeft} 次。先作决定，再结算今天。`;
}
