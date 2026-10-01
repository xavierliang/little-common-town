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
  turnInstruction,
  missedMealsOnDay,
  type Game,
  type Action,
} from "./game";
import { metrics, serialize } from "./sim";
import { registerTownReader } from "./webmcp";
import "./game.css";
import { buildingForHouse } from "./scene-routes";
const cash = (n: number) => `¥${(n / 100).toFixed(2)}`;
type Context = { kind: "council" | "resident" | "firm" | "house"; id: string };
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
      <div className="world-error">
        <strong>这台设备暂时无法显示 3D</strong>
        <p>游戏仍可通过下方行动和居民名单继续。</p>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function GameApp() {
  const [game, setGame] = useState<Game>(() => {
    try {
      const raw = localStorage.getItem("little-common-challenge-v1");
      return raw ? decodeGame(raw) : newGame();
    } catch {
      return newGame();
    }
  });
  const [context, setContext] = useState<Context>({
      kind: "council",
      id: "hall",
    }),
    [selected, setSelected] = useState("r1"),
    [playing, setPlaying] = useState(false),
    [stage, setStage] = useState(0),
    [report, setReport] = useState(false),
    [sandbox, setSandbox] = useState(false),
    [dialog, setDialog] = useState<
      "help" | "goals" | "roster" | "ledger" | null
    >(null),
    [message, setMessage] = useState(""),
    [collapsed, setCollapsed] = useState(false),
    [cameraReset, setCameraReset] = useState(0);
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
        setMessage(`第 ${latest.current.town.day} 天已结算。下一步由你决定。`);
      }, 4500),
    ];
    return () => timers.forEach(clearTimeout);
  }, [playing]);
  useEffect(() => {
    function close(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setDialog(null);
        setReport(false);
      }
    }
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  const m = metrics(game.town),
    person =
      game.town.residents.find((r) => r.id === selected) ||
      game.town.residents[0],
    firm = game.town.firms.find((f) => f.id === context.id),
    house = game.town.households.find((h) => h.id === context.id),
    done = game.town.day >= 7,
    g = goals(game),
    won = g.food && g.work && g.reserve,
    free = game.actionsLeft > 0 && !playing && !done;
  const houseMembers = house
    ? game.town.households
        .filter((h) => buildingForHouse(h.id) === buildingForHouse(house.id))
        .flatMap((h) => h.memberIds)
    : [];
  const missed = missedMealsOnDay(game.town, game.town.day),
    modalOpen = !!dialog || report;
  const roster = [...game.town.residents].sort(
    (a, b) =>
      b.hunger - a.hunger ||
      game.town.accounts[a.accountId].balanceCents -
        game.town.accounts[b.accountId].balanceCents,
  );
  function selectResident(id: string) {
    setSelected(id);
    setContext({ kind: "resident", id });
    setCollapsed(false);
    setDialog(null);
  }
  function selectBuilding(id: string) {
    setContext({
      kind: id.startsWith("f")
        ? "firm"
        : id.startsWith("h") && id !== "hall"
          ? "house"
          : "council",
      id,
    });
    setCollapsed(false);
  }
  function action(a: Action) {
    try {
      if (settling.current) return;
      const target = context.kind === "firm" ? context.id : undefined;
      const next = act(latest.current, a, person.id, target);
      latest.current = next;
      setGame(next);
      setMessage(
        a === "aid"
          ? `${person.name} 收到 ¥1.80，结算时会按需要买饭。`
          : a === "jobs"
            ? "¥6.00 已进入企业周转金账户，招聘仍取决于需求。"
            : a === "automation"
              ? "已投入 ¥10.00，效率提高 0.5×。注意下一天岗位的变化。"
              : a === "sharing"
                ? "每日补助已开启，目标 ¥11.20 / 天，持续到你暂停。"
                : "每日补助已暂停，财政保留应急金。",
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
      setCollapsed(true);
      setMessage("正在回放实际工作、购物与归家记录…");
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
    setContext({ kind: "council", id: "hall" });
    setReport(false);
    setPlaying(false);
    setDialog(null);
    setCollapsed(false);
    setCameraReset((n) => n + 1);
    setMessage("相同起点，新的决定。");
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
          <span>自由实验 · 原有存档与政策工具保留</span>
        </div>
        <Sandbox />
      </>
    );
  return (
    <div className="town-play">
      <div className="town-viewport" aria-label="可互动的三维小镇">
        <MapBoundary>
          <TownScene
            state={game.town}
            selected={context.kind === "resident" ? person.id : ""}
            onSelect={selectResident}
            running={playing}
            selectedBuilding={
              context.kind === "firm" || context.kind === "house"
                ? context.id
                : ""
            }
            onBuildingSelect={selectBuilding}
            focus={
              context.kind === "council"
                ? null
                : {
                    kind: context.kind === "resident" ? "resident" : "building",
                    id: context.id,
                  }
            }
            resetView={cameraReset}
            hideLabels={modalOpen}
          />
        </MapBoundary>
      </div>
      <header className="town-hud">
        <div className="town-title">
          <span className="town-logo">⌂</span>
          <div>
            <strong>小小共生镇</strong>
            <small>
              {done
                ? "这一周结束了"
                : `第 ${game.town.day + 1} 天 · ${playing ? "今日回放" : "等待你的决定"}`}
            </small>
          </div>
        </div>
        <button
          className="hud-goals"
          onClick={() => setDialog("goals")}
          aria-label="查看七天目标"
        >
          <span>
            餐食{" "}
            <b>
              {game.meals}
              <i>/100</i>
            </b>
          </span>
          <span>
            班次{" "}
            <b>
              {game.shifts}
              <i>/40</i>
            </b>
          </span>
          <span>
            财政{" "}
            <b className={m.treasuryCents < 400 ? "warning" : ""}>
              {cash(m.treasuryCents)}
            </b>
          </span>
        </button>
        <button
          className="hud-help"
          onClick={() => setDialog("help")}
          aria-label="怎么玩"
        >
          ?
        </button>
      </header>
      <nav className="world-tools" aria-label="小镇工具">
        <button
          onClick={() => {
            setCameraReset((n) => n + 1);
            setContext({ kind: "council", id: "hall" });
          }}
          title="看全镇"
        >
          <Icon kind="map" />
          <span>全镇</span>
        </button>
        <button onClick={() => setDialog("roster")}>
          <Icon kind="people" />
          <span>居民</span>
        </button>
        <button onClick={() => selectBuilding("hall")}>
          <Icon kind="hall" />
          <span>议事</span>
        </button>
        <button onClick={() => setDialog("ledger")}>
          <Icon kind="book" />
          <span>账本</span>
        </button>
      </nav>
      <div className="world-hint">
        {playing
          ? ["上班与生产", "按真实交易购物", "回到自己的家"][stage]
          : "点选居民或建筑 · 拖动旋转 · 双指缩放"}
      </div>
      <section
        className={`context-tray ${collapsed ? "is-collapsed" : ""}`}
        aria-label="当前对象与行动"
      >
        <div className="tray-heading">
          <div>
            <small>
              {context.kind === "resident"
                ? "居民"
                : context.kind === "firm"
                  ? "食品企业"
                  : context.kind === "house"
                    ? "住户"
                    : "七天开镇挑战"}
            </small>
            <h1>
              {context.kind === "resident"
                ? person.name
                : context.kind === "firm"
                  ? firm?.name
                  : context.kind === "house"
                    ? "居民小屋"
                    : "今天，把预算花在哪里？"}
            </h1>
          </div>
          <span
            className="action-pips"
            aria-label={`还可行动 ${game.actionsLeft} 次`}
          >
            {[0, 1].map((i) => (
              <i
                key={i}
                className={i < game.actionsLeft && !done ? "available" : ""}
              />
            ))}
            <b>{done ? "已结束" : `${game.actionsLeft} 次行动`}</b>
          </span>
          <button
            className="tray-toggle"
            aria-label={collapsed ? "展开行动面板" : "收起行动面板"}
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? "⌃" : "⌄"}
          </button>
        </div>
        {!collapsed && (
          <div className="tray-body">
            {context.kind === "council" && (
              <>
                <p className="tray-note">{recommendation(game)}</p>
                <div className="action-grid">
                  <ActionButton
                    title="支持招聘"
                    detail="企业周转金 · ¥6"
                    icon="people"
                    disabled={
                      !free ||
                      game.actionsToday.includes("jobs") ||
                      m.treasuryCents < 600
                    }
                    onClick={() => action("jobs")}
                  />
                  <ActionButton
                    title="投资自动化"
                    detail="生产率 +0.5× · ¥10"
                    icon="gear"
                    disabled={
                      !free ||
                      game.actionsToday.includes("automation") ||
                      m.treasuryCents < 1000 ||
                      game.town.policy.aiProductivity >= 3
                    }
                    onClick={() => action("automation")}
                  />
                  <ActionButton
                    title={
                      game.town.policy.ubiCents ? "暂停补助" : "开启普惠补助"
                    }
                    detail={
                      game.town.policy.ubiCents
                        ? "停止每日支出"
                        : "每天目标 ¥11.20"
                    }
                    icon="heart"
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
                  <ActionButton
                    title="找到需要帮助的人"
                    detail="点选居民，定向救助"
                    icon="search"
                    onClick={() => setDialog("roster")}
                  />
                </div>
              </>
            )}
            {context.kind === "resident" && (
              <>
                <div className="resident-facts">
                  <Fact
                    label="个人资金"
                    value={cash(
                      game.town.accounts[person.accountId].balanceCents,
                    )}
                  />
                  <Fact label="食物" value={`${person.food} 份`} />
                  <Fact
                    label="今天工作"
                    value={person.employerId ? "有班" : "待岗"}
                  />
                </div>
                <p className="tray-note">
                  {missed.includes(person.name)
                    ? "今天没吃到饭。"
                    : person.hunger > 0
                      ? "今天吃到了饭，但仍有之前累积的饥饿。"
                      : "目前吃饱了。"}{" "}
                  精力 {person.energy}/100 ·{" "}
                  {person.employerId
                    ? game.town.firms.find((f) => f.id === person.employerId)
                        ?.name
                    : "还没有今天的岗位"}
                </p>
                <div className="action-grid resident-actions-grid">
                  <ActionButton
                    title={`救助 ${person.name}`}
                    detail="转入个人账户 · ¥1.80"
                    icon="heart"
                    disabled={!free || m.treasuryCents < 180}
                    onClick={() => action("aid")}
                  />
                  <ActionButton
                    title="换一位居民"
                    detail="按饥饿和现金排序"
                    icon="people"
                    onClick={() => setDialog("roster")}
                  />
                </div>
              </>
            )}
            {context.kind === "firm" && firm && (
              <>
                <div className="resident-facts">
                  <Fact
                    label="企业资金"
                    value={cash(
                      game.town.accounts[firm.accountId].balanceCents,
                    )}
                  />
                  <Fact label="库存" value={`${firm.inventory} 份`} />
                  <Fact
                    label="今日岗位"
                    value={`${firm.workerIds.length} 人`}
                  />
                </div>
                <p className="tray-note">
                  单价 {cash(firm.priceCents)} · 工资 {cash(firm.wageCents)} /
                  班。投资进入周转金，不保证新增岗位。
                </p>
                <div className="action-grid">
                  <ActionButton
                    title="为这家企业注资"
                    detail="工资周转金 · ¥6"
                    icon="people"
                    disabled={
                      !free ||
                      game.actionsToday.includes("jobs") ||
                      m.treasuryCents < 600
                    }
                    onClick={() => action("jobs")}
                  />
                  <ActionButton
                    title="升级全镇自动化"
                    detail="效率 +0.5× · ¥10"
                    icon="gear"
                    disabled={
                      !free ||
                      game.actionsToday.includes("automation") ||
                      m.treasuryCents < 1000 ||
                      game.town.policy.aiProductivity >= 3
                    }
                    onClick={() => action("automation")}
                  />
                </div>
              </>
            )}
            {context.kind === "house" && house && (
              <>
                <p className="tray-note">
                  两户居民共用这栋小屋。每个人有独立账户，点击姓名查看生活和资金。
                </p>
                <div className="house-members">
                  {houseMembers.map((id) => {
                    const r = game.town.residents.find((r) => r.id === id)!;
                    return (
                      <button key={id} onClick={() => selectResident(id)}>
                        <span>{r.name.slice(0, 1)}</span>
                        <strong>{r.name}</strong>
                        <small>
                          {cash(game.town.accounts[r.accountId].balanceCents)} ·
                          食物 {r.food}
                        </small>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            <p className="turn-message" role="status">
              {message || turnInstruction(game)}
            </p>
          </div>
        )}
        <div className="tray-footer">
          <button
            className="council-link"
            onClick={() => {
              selectBuilding("hall");
              setCollapsed(false);
            }}
          >
            {game.town.policy.ubiCents ? "补助开启 · ¥11.20/天" : "补助关闭"}
            <small>
              所得税 20% · AI {game.town.policy.aiProductivity.toFixed(1)}×
            </small>
          </button>
          <button
            className="settle-button"
            disabled={playing}
            onClick={() => (done ? setReport(true) : settle())}
          >
            {playing
              ? "居民正在行动…"
              : done
                ? "查看本轮结果"
                : `结算第 ${game.town.day + 1} 天`}
            <span>{done ? "回顾这一周" : "先决策，再看后果"}</span>
          </button>
        </div>
      </section>
      {report && (
        <Modal
          title={
            done
              ? won
                ? "委托完成"
                : "这一周，还差一点"
              : missed.length
                ? `${missed.length} 位居民没吃到饭`
                : "今天，大家都吃到了饭"
          }
          eyebrow={done ? "七天挑战结束" : `第 ${game.town.day} 天 · 每日结算`}
          onClose={() => setReport(false)}
        >
          <div className="result-facts">
            <Fact label="今日吃到饭" value={`${m.consumedToday}/16`} />
            <Fact label="今日岗位" value={`${m.employed}`} />
            <Fact label="财政" value={cash(m.treasuryCents)} />
          </div>
          <p>
            {done
              ? `累计 ${game.meals} 餐、${game.shifts} 个班次，保留 ${cash(m.treasuryCents)}。`
              : missed.length
                ? `今日缺餐：${missed.join("、")}。`
                : "16 位居民今天都吃到了饭。"}
          </p>
          <p className="modal-note">
            {done
              ? "本关目标：100 餐、40 个班次、¥4 应急金。这是人为设定的模型关卡，不代表现实政策的优劣。"
              : "缺餐名单只统计今天没有吃到饭的人，和累积饥饿程度不同。"}
          </p>
          <button
            className="modal-primary"
            onClick={() =>
              done
                ? reset()
                : (setReport(false),
                  setCollapsed(false),
                  setMessage(turnInstruction(game)))
            }
          >
            {done ? "同一起点，再试一次" : `安排第 ${game.town.day + 1} 天`}
          </button>
          <button className="modal-secondary" onClick={() => setReport(false)}>
            回到小镇
          </button>
        </Modal>
      )}
      {dialog === "roster" && (
        <Modal
          title="小镇的 16 位居民"
          eyebrow="点击居民，在地图上找到他"
          onClose={() => setDialog(null)}
        >
          <div className="roster-grid">
            {roster.map((r) => (
              <button key={r.id} onClick={() => selectResident(r.id)}>
                <span className={missed.includes(r.name) ? "needs-food" : ""}>
                  {r.name[0]}
                </span>
                <strong>{r.name}</strong>
                <small>
                  {cash(game.town.accounts[r.accountId].balanceCents)} ·{" "}
                  {missed.includes(r.name)
                    ? "今日缺餐"
                    : r.hunger > 0
                      ? "累积饥饿"
                      : r.employerId
                        ? "今天有班"
                        : "待岗"}
                </small>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {dialog === "goals" && (
        <Modal
          title="撑过开镇的第一周"
          eyebrow={`${game.town.day} / 7 天已完成`}
          onClose={() => setDialog(null)}
        >
          <div className="goal-list">
            <Progress
              title="吃到的饭"
              value={game.meals}
              target={100}
              unit="餐"
            />
            <Progress
              title="累计工作"
              value={game.shifts}
              target={40}
              unit="班"
            />
            <Progress
              title="最后的应急金"
              value={m.treasuryCents / 100}
              target={4}
              unit="元"
            />
          </div>
          <p>
            每天最多两次行动，可以选择不花完。投入、补助和生产率的后果都会进入同一本账。
          </p>
          <p className="modal-note">
            这是有限预算的游戏委托，不是现实社会政策评价。
          </p>
        </Modal>
      )}
      {dialog === "ledger" && (
        <Modal
          title="每一笔，都有来处"
          eyebrow="资金守恒 · 账本可追溯"
          onClose={() => setDialog(null)}
        >
          <div className="result-facts">
            <Fact label="居民合计" value={cash(m.householdCashCents)} />
            <Fact label="企业合计" value={cash(m.firmCashCents)} />
            <Fact label="公共账户" value={cash(m.treasuryCents)} />
          </div>
          <div className="recent-ledger">
            {game.town.ledger
              .slice(-12)
              .reverse()
              .map((e) => (
                <div key={e.id}>
                  <span>{e.memo}</span>
                  <b>{cash(e.amountCents)}</b>
                </div>
              ))}
          </div>
          <button className="modal-secondary" onClick={exportTown}>
            导出完整账本
          </button>
        </Modal>
      )}
      {dialog === "help" && (
        <Modal
          title="住进这座小镇的节奏里"
          eyebrow="观察 → 选择 → 结算 → 再决定"
          onClose={() => setDialog(null)}
        >
          <ol>
            <li>点选居民或建筑，相关行动会出现在地图下方</li>
            <li>每天两次行动：救助、支持招聘、投资工具或调整补助</li>
            <li>结算一天后，居民按真实岗位和交易记录上班、购物、回家</li>
            <li>七天达成 100 餐、40 班次，并留 ¥4 应急金</li>
          </ol>
          <p className="modal-note">
            初始财政 ¥40，企业各 ¥8，个人资金
            ¥1–2.50。挑战会自动保存在这台设备；沙盒存档另存。建筑与农田是场景，经济只计算两家食品企业和一种必需品。
          </p>
          <button className="modal-primary" onClick={() => setDialog(null)}>
            回到小镇
          </button>
          <div className="modal-row">
            <button
              onClick={() => {
                setDialog(null);
                setSandbox(true);
              }}
            >
              自由沙盒
            </button>
            <button
              onClick={() => {
                if (
                  window.confirm(
                    "回到同一起点？本轮挑战进度会重置，沙盒存档不变。",
                  )
                )
                  reset();
              }}
            >
              重新开始挑战
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}
function ActionButton({
  title,
  detail,
  icon,
  disabled,
  onClick,
}: {
  title: string;
  detail: string;
  icon: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button className="context-action" disabled={disabled} onClick={onClick}>
      <Icon kind={icon} />
      <span>
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
    </button>
  );
}
function Modal({
  title,
  eyebrow,
  onClose,
  children,
}: {
  title: string;
  eyebrow: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="town-modal-backdrop" onClick={onClose}>
      <section
        className="town-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" aria-label="关闭弹窗" onClick={onClose}>
          ×
        </button>
        <small className="modal-eyebrow">{eyebrow}</small>
        <h2>{title}</h2>
        {children}
      </section>
    </div>
  );
}
function Progress({
  title,
  value,
  target,
  unit,
}: {
  title: string;
  value: number;
  target: number;
  unit: string;
}) {
  return (
    <div className="goal-row">
      <span>{title}</span>
      <strong>
        {value.toFixed(value % 1 ? 2 : 0)} / {target}
        {unit}
      </strong>
      <i>
        <b style={{ width: `${Math.min(100, (value / target) * 100)}%` }} />
      </i>
    </div>
  );
}
function Icon({ kind }: { kind: string }) {
  const paths: Record<string, string> = {
    people:
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m9-7a4 4 0 0 1 0 8m4 9v-2a4 4 0 0 0-3-4",
    heart:
      "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
    hall: "m3 10 9-7 9 7M5 10v11h14V10M10 21v-7h4v7",
    book: "M3 3h6a4 4 0 0 1 3 2 4 4 0 0 1 3-2h6v17h-6a4 4 0 0 0-3 2 4 4 0 0 0-3-2H3Zm9 2v17",
    map: "m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Zm6-3v15m6-12v15",
    search: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14m5-2 6 6",
    gear: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8m0-6v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[kind] || paths.hall} />
    </svg>
  );
}
