import { useEffect, useRef, useState, Component, type ReactNode } from "react";
import TownScene from "./TownScene";
import Sandbox from "./Sandbox";
import {
  newGame,
  encodeGame,
  decodeGame,
  act,
  nextDay,
  goals,
  recommendation,
  type Game,
  type Action,
} from "./game";
import { metrics, serialize } from "./sim";
import { registerTownReader } from "./webmcp";
import "./game.css";
const cash = (n: number) => `¥${(n / 100).toFixed(2)}`;
class MapBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="game-map-error">
        3D 画面无法加载。可以先用居民列表继续挑战。
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function GameApp() {
  const [game, setGame] = useState<Game>(() => {
      try {
        const saved = localStorage.getItem("little-common-challenge-v1");
        return saved ? decodeGame(saved) : newGame();
      } catch {
        return newGame();
      }
    }),
    [selected, setSelected] = useState("r1"),
    [playing, setPlaying] = useState(false),
    [stage, setStage] = useState(0),
    [report, setReport] = useState(false),
    [sandbox, setSandbox] = useState(false),
    [help, setHelp] = useState(false),
    [message, setMessage] = useState(
      "你是新任镇长。今天有两次行动，先作决定，再让一天发生。",
    );
  const latest = useRef(game);
  latest.current = game;
  const settling = useRef(false);
  useEffect(() => {
    try {
      localStorage.setItem("little-common-challenge-v1", encodeGame(game));
    } catch {}
  }, [game]);
  useEffect(() => registerTownReader(() => latest.current.town), []);
  useEffect(() => {
    if (!playing) return;
    const timers = [
      setTimeout(() => setStage(1), 1500),
      setTimeout(() => setStage(2), 3000),
      setTimeout(() => {
        settling.current = false;
        setPlaying(false);
        setReport(true);
      }, 4500),
    ];
    return () => timers.forEach(clearTimeout);
  }, [playing]);
  const m = metrics(game.town),
    person =
      game.town.residents.find((r) => r.id === selected) ||
      game.town.residents[0],
    done = game.town.day >= 7,
    g = goals(game),
    won = g.food && g.work && g.reserve,
    free = game.actionsLeft > 0 && !playing && !done;
  const poorest = [...game.town.residents].sort(
    (a, b) =>
      b.hunger - a.hunger ||
      game.town.accounts[a.accountId].balanceCents -
        game.town.accounts[b.accountId].balanceCents,
  );
  function action(a: Action) {
    try {
      if (settling.current) return;
      const next = act(latest.current, a, person.id);
      latest.current = next;
      setGame(next);
      setMessage(
        a === "aid"
          ? `${person.name} 收到 ¥1.80，个人账户已增加。结算时会按需要买饭。`
          : a === "jobs"
            ? "¥6.00 已进入企业账户，补充招聘和工资所需的周转金。"
            : a === "automation"
              ? "已投入 ¥10.00，生产率提高 0.5 倍。留意下一天的岗位变化。"
              : a === "sharing"
                ? "每人每天补助 ¥0.70，总目标 ¥11.20 / 天，持续到你暂停。"
                : "已暂停普惠补助，保留财政余额。",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "行动失败");
    }
  }
  function settle() {
    try {
      if (settling.current) return;
      settling.current = true;
      const next = nextDay(latest.current);
      latest.current = next;
      setGame(next);
      setStage(0);
      setPlaying(true);
      setReport(false);
      setMessage("正在回放今天真实发生的工作、购物和归家记录…");
    } catch (e) {
      settling.current = false;
      setMessage(e instanceof Error ? e.message : "结算失败");
    }
  }
  function reset() {
    settling.current = false;
    const next = newGame();
    latest.current = next;
    setGame(next);
    setSelected("r1");
    setReport(false);
    setPlaying(false);
    setMessage("回到相同起点，试试另一种预算分配。");
  }
  function exportTown() {
    const u = URL.createObjectURL(
      new Blob([serialize(game.town)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = u;
    a.download = `town-challenge-day-${game.town.day}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  }
  if (sandbox)
    return (
      <>
        <div className="sandbox-return">
          <button onClick={() => setSandbox(false)}>回到七天挑战</button>
          <span>自由实验：没有过关目标，原有存档功能保留</span>
        </div>
        <Sandbox />
      </>
    );
  return (
    <div className="town-game">
      <header className="game-header">
        <div>
          <span className="game-mark">⌂</span>
          <strong>小小共生镇</strong>
          <span className="edition">七天开镇挑战</span>
        </div>
        <button onClick={() => setHelp(true)}>怎么玩</button>
        <button onClick={() => setSandbox(true)}>沙盒</button>
      </header>
      <main className="game-layout">
        <section className="game-world">
          <div className="mission">
            <div className="mission-top">
              <div>
                <small>你的委托</small>
                <h1>让小镇撑过第一周</h1>
              </div>
              <div className="round">
                {done ? "本轮结束" : `准备第 ${game.town.day + 1} 天`}
                <small>{game.town.day} / 7 天已完成</small>
              </div>
            </div>
            <div className="goals">
              <Goal
                label="吃到的饭"
                value={game.meals}
                target={100}
                suffix="餐"
              />
              <Goal
                label="累计工作"
                value={game.shifts}
                target={40}
                suffix="班"
              />
              <div className="game-goal">
                <span>应急金 · 目标 ≥ ¥4</span>
                <strong className={m.treasuryCents < 400 ? "danger" : ""}>
                  {cash(m.treasuryCents)}
                </strong>
                <div className="goal-track">
                  <i
                    style={{
                      width: `${Math.min(100, (m.treasuryCents / 4000) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="game-map">
            <MapBoundary>
              <TownScene
                state={game.town}
                selected={person.id}
                onSelect={setSelected}
                running={playing}
              />
            </MapBoundary>
            <div className="map-status">
              {playing
                ? [
                    "今日回放 · 上班与生产",
                    "今日回放 · 实际购物",
                    "今日回放 · 带着结果回家",
                  ][stage]
                : "点选居民，看谁需要你的帮助"}
            </div>
            <div className="person-chip">
              <div>
                <strong>{person.name}</strong>
                <span>
                  {cash(game.town.accounts[person.accountId].balanceCents)} ·
                  食物 {person.food} 份
                </span>
              </div>
              <button
                disabled={!free || m.treasuryCents < 180}
                onClick={() => action("aid")}
              >
                救助 ¥1.80
              </button>
            </div>
          </div>
          <div className="resident-strip" aria-label="选择居民">
            {poorest.map((r) => (
              <button
                className={r.id === person.id ? "selected" : ""}
                key={r.id}
                onClick={() => setSelected(r.id)}
              >
                <span
                  className={
                    r.hunger > 0
                      ? "hungry"
                      : game.town.accounts[r.accountId].balanceCents < 120
                        ? "poor"
                        : ""
                  }
                >
                  {r.name.slice(0, 1)}
                </span>
                <b>{r.name}</b>
                <small>
                  {r.hunger > 0
                    ? "没吃饱"
                    : game.town.accounts[r.accountId].balanceCents < 120
                      ? "缺买饭钱"
                      : r.employerId
                        ? "今天有班"
                        : "待岗"}
                </small>
              </button>
            ))}
          </div>
          <div className="day-facts">
            <span>
              今天 <b>{m.consumedToday}/16</b> 人吃到饭
            </span>
            <span>
              <b>{m.employed}</b> 人有班
            </span>
            <span>
              AI 效率 <b>{game.town.policy.aiProductivity.toFixed(1)}×</b>
            </span>
          </div>
        </section>
        <section className="decision-panel">
          <div className="decision-heading">
            <div>
              <small>有限预算，真实后果</small>
              <h2>{done ? "这一周的答卷" : "今天你怎么安排？"}</h2>
            </div>
            <span className="action-count">
              {done ? "7 天结束" : `还可行动 ${game.actionsLeft} 次`}
            </span>
          </div>
          <p className="game-tip">{recommendation(game)}</p>
          <div className="decision-cards">
            <Card
              title="支持招聘"
              cost="¥6.00 / 次"
              detail="为资金较少的企业补充工资周转金；有订单才会招聘。"
              disabled={
                !free ||
                game.actionsToday.includes("jobs") ||
                m.treasuryCents < 600
              }
              onClick={() => action("jobs")}
            />
            <Card
              title="投资自动化"
              cost="¥10.00 / 次"
              detail="永久增加 0.5× 生产率；同样产量可能需要更少工人。"
              disabled={
                !free ||
                game.actionsToday.includes("automation") ||
                m.treasuryCents < 1000 ||
                game.town.policy.aiProductivity >= 3
              }
              onClick={() => action("automation")}
            />
            <Card
              title={
                game.town.policy.ubiCents ? "暂停普惠补助" : "开启普惠补助"
              }
              cost={
                game.town.policy.ubiCents ? "停止每日支出" : "目标 ¥11.20 / 天"
              }
              detail={
                game.town.policy.ubiCents
                  ? "暂停后，今天不再发这笔补助。可继续救助个别居民。"
                  : "每人每天 ¥0.70，持续生效；财政不足时按余额发放。"
              }
              disabled={
                !free ||
                game.actionsToday.includes(
                  game.town.policy.ubiCents ? "reserve" : "sharing",
                )
              }
              onClick={() =>
                action(game.town.policy.ubiCents ? "reserve" : "sharing")
              }
            />
            <Card
              title={`救助 ${person.name}`}
              cost="¥1.80 / 次"
              detail="直接进入选中居民的账户。他会在结算时按需购买食物。"
              disabled={!free || m.treasuryCents < 180}
              onClick={() => action("aid")}
            />
          </div>
          <div className="game-feedback" role="status">
            {message}
          </div>
          <div className="end-turn">
            <div>
              <b>财政 {cash(m.treasuryCents)}</b>
              <small>
                {game.town.policy.ubiCents
                  ? "每日补助目标 ¥11.20"
                  : "每日补助已暂停"}{" "}
                · 所得税 20%
              </small>
            </div>
            {done ? (
              <button onClick={() => setReport(true)}>查看本轮结果</button>
            ) : (
              <button disabled={playing} onClick={settle}>
                {playing ? "居民正在行动…" : `结算第 ${game.town.day + 1} 天`}
              </button>
            )}
          </div>
          <details className="game-audit">
            <summary>看企业和最近账目</summary>
            {game.town.firms.map((f) => (
              <p key={f.id}>
                {f.name}：{cash(game.town.accounts[f.accountId].balanceCents)} ·
                库存 {f.inventory} · 今天 {f.workerIds.length} 个岗位
              </p>
            ))}
            {game.town.ledger
              .slice(-5)
              .reverse()
              .map((e) => (
                <p key={e.id}>
                  {e.memo} · {cash(e.amountCents)}
                </p>
              ))}
            <button onClick={exportTown}>导出完整账本</button>
            <p>
              游戏目标是人为设置的关卡条件，不代表现实政策优劣。货币和食物均守恒。
            </p>
          </details>
        </section>
      </main>
      {report && (
        <div className="game-dialog-backdrop">
          <section
            className="game-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="每日结算"
          >
            <small>
              {done ? "七天挑战结束" : `第 ${game.town.day} 天，夜幕降临`}
            </small>
            <h2>
              {done
                ? won
                  ? "委托完成！"
                  : "这次，还差一点"
                : m.unmetNeedsToday === 0
                  ? "今天，大家都吃到了饭"
                  : `${m.unmetNeedsToday} 位居民没吃到饭`}
            </h2>
            <div className="result-numbers">
              <div>
                <strong>{m.consumedToday}/16</strong>
                <span>今天吃到饭</span>
              </div>
              <div>
                <strong>{m.employed}</strong>
                <span>今天有班</span>
              </div>
              <div>
                <strong>{cash(m.treasuryCents)}</strong>
                <span>财政余额</span>
              </div>
            </div>
            <p>
              {done
                ? `本轮共 ${game.meals} 餐 / 目标 100，${game.shifts} 个班次 / 目标 40，应急金 ${cash(m.treasuryCents)} / 目标 ¥4。`
                : game.town.residents
                    .filter((r) => r.hunger > 0)
                    .map((r) => r.name)
                    .join("、") || "16 位居民暂时都吃饱了。"}
            </p>
            <p className="small">
              {done
                ? "不同的预算组合会得到不同结果。回到同一起点再试试；这只是本关模型。"
                : "下一天继续观察谁缺钱、谁有工作。你还有两次行动。"}
            </p>
            <button
              className="primary"
              onClick={() => (done ? reset() : setReport(false))}
            >
              {done ? "同一起点，再试一次" : `安排第 ${game.town.day + 1} 天`}
            </button>
            {done && (
              <button
                onClick={() => {
                  setReport(false);
                  setSandbox(true);
                }}
              >
                进入自由沙盒
              </button>
            )}
            <button className="subtle" onClick={() => setReport(false)}>
              返回小镇
            </button>
          </section>
        </div>
      )}
      {help && (
        <div className="game-dialog-backdrop" onClick={() => setHelp(false)}>
          <section
            className="game-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="挑战说明"
            onClick={(e) => e.stopPropagation()}
          >
            <small>一轮约 3 分钟</small>
            <h2>先做决定，再看居民行动</h2>
            <ol>
              <li>每天有两次行动，可以留着不花</li>
              <li>点选缺钱居民救助，或注资、投资工具、改变补助</li>
              <li>按「结算今天」，观看真实工作和购物结果的回放</li>
              <li>七天内累计 100 餐、40 个班次，最后留 ¥4 应急金</li>
            </ol>
            <p>
              初始财政 ¥40，企业各 ¥8，居民各
              ¥1–2.50。救助和投资都会真实扣钱。这是游戏关卡，不是经济预测。
            </p>
            <p>沙盒保留角色、政策、存档功能。挑战不会覆盖旧沙盒存档。</p>
            <button className="primary" onClick={() => setHelp(false)}>
              开始作决定
            </button>
            <button
              onClick={() => {
                reset();
                setHelp(false);
              }}
            >
              重新开始本轮
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
function Goal({
  label,
  value,
  target,
  suffix,
}: {
  label: string;
  value: number;
  target: number;
  suffix: string;
}) {
  return (
    <div className="game-goal">
      <span>
        {label} · 目标 {target}
        {suffix}
      </span>
      <strong>
        {value}
        <em> / {target}</em>
      </strong>
      <div className="goal-track">
        <i style={{ width: `${Math.min(100, (value / target) * 100)}%` }} />
      </div>
    </div>
  );
}
function Card({
  title,
  cost,
  detail,
  disabled,
  onClick,
}: {
  title: string;
  cost: string;
  detail: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button className="decision-card" disabled={disabled} onClick={onClick}>
      <strong>{title}</strong>
      <b>{cost}</b>
      <small>{detail}</small>
    </button>
  );
}
