import {
  Component,
  Suspense,
  lazy,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  accounting,
  advance,
  bottleneck,
  decodeExperiment,
  defaultLayout,
  directionalCell,
  encodeExperiment,
  facilityDistance,
  facilityNames,
  initialExperiment,
  load,
  moveFacility,
  names,
  observe,
  rules,
  seconds,
  walls,
  type Cell,
  type Experiment,
  type FacilityId,
  type WorkerId,
} from "./experiment-engine";
import { bakeryAssets } from "./bakery-assets";
import "./experiment.css";
const ExperimentScene = lazy(() => import("./ExperimentScene"));
export const EXPERIMENT_SAVE = "little-common-rules-experiment-v1";
const ids: FacilityId[] = ["store", "oven", "table"];
class SceneBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFailure();
  }
  render() {
    return this.state.failed ? (
      <div className="exp-loading">
        这台设备暂时无法显示 3D。下方地格仍可摆放设施，模拟账目继续有效。
      </div>
    ) : (
      this.props.children
    );
  }
}
function restore(): { world: Experiment; notice: string } {
  try {
    const raw = localStorage.getItem(EXPERIMENT_SAVE);
    return {
      world: raw
        ? { ...decodeExperiment(raw), paused: true }
        : initialExperiment(),
      notice: raw ? "已恢复进度并暂停，按继续观察可接着运行" : "",
    };
  } catch {
    return {
      world: initialExperiment(),
      notice: "原存档无法读取，已打开新的实验；面包故事存档不受影响",
    };
  }
}
const fmt = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1));
export default function ExperimentApp({ onExit }: { onExit: () => void }) {
  const [restored] = useState(restore);
  const [world, renderWorld] = useState(restored.world);
  const worldRef = useRef(world);
  function setWorld(
    action: Experiment | ((current: Experiment) => Experiment),
  ) {
    const next =
      typeof action === "function" ? action(worldRef.current) : action;
    worldRef.current = next;
    renderWorld(next);
  }
  const [notice, setNotice] = useState(restored.notice);
  const [speed, setSpeed] = useState(1);
  const [tab, setTab] = useState<"observe" | "layout" | "ledger">("observe");
  const [facility, setFacility] = useState<FacilityId>("store");
  const [selected, setSelected] = useState<WorkerId>("ahe");
  const [help, setHelp] = useState(false);
  const [failed, setFailed] = useState(false);
  const [previous, setPrevious] = useState("");
  const dialog = useRef<HTMLDivElement>(null);
  const total = accounting(world);
  useEffect(() => {
    try {
      localStorage.setItem(EXPERIMENT_SAVE, encodeExperiment(world));
    } catch {
      setNotice("浏览器未能保存本次实验。观察仍可继续，请暂时保留这个页面。");
    }
  }, [world]);
  useEffect(() => {
    if (world.paused) return;
    const timer = setInterval(
      () => setWorld((s) => advance(s, rules.tickSeconds * speed)),
      250,
    );
    return () => clearInterval(timer);
  }, [world.paused, speed]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) {
        setWorld((s) => ({ ...s, paused: true }));
        setNotice("离开页面时已暂停，没有在后台跳过供给过程");
      }
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);
  useEffect(() => {
    if (!help) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setHelp(false);
        return;
      }
      if (e.key === "Tab") {
        const all =
          dialog.current?.querySelectorAll<HTMLButtonElement>("button");
        if (!all?.length) return;
        if (e.shiftKey && document.activeElement === all[0]) {
          e.preventDefault();
          all[all.length - 1].focus();
        }
        if (!e.shiftKey && document.activeElement === all[all.length - 1]) {
          e.preventDefault();
          all[0].focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previousFocus?.focus();
    };
  }, [help]);
  function move(
    id: FacilityId,
    target: Cell | "up" | "right" | "down" | "left",
  ) {
    try {
      const current = worldRef.current;
      const cell =
        typeof target === "string"
          ? directionalCell(current.layout[id], target)
          : target;
      setWorld(moveFacility(current, id, cell));
      setNotice(`${facilityNames[id]} 已移动；继续后按新位置寻路`);
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  function pick(cell: Cell) {
    const found = ids.find(
      (id) =>
        world.layout[id][0] === cell[0] && world.layout[id][1] === cell[1],
    );
    if (found) {
      setFacility(found);
      setTab("layout");
      setWorld((s) => ({ ...s, paused: true }));
      return;
    }
    if (tab === "layout") move(facility, cell);
  }
  function reset(original = false) {
    setPrevious(
      `上次观察 ${fmt(seconds(world))} 秒：出炉 ${world.produced} 个，吃了 ${total.eaten} 个，走了 ${fmt(world.workers.reduce((n, w) => n + w.walked, 0))} 格`,
    );
    setWorld(initialExperiment(original ? defaultLayout : world.layout));
    setNotice(
      original
        ? "已恢复原始布局与供给"
        : "布局保留；物料、电能、饥饿和时间已回到同一起点",
    );
  }
  const distance = (a: FacilityId, b: FacilityId) => {
    const d = facilityDistance(world.layout, a, b);
    return d === null ? "不通" : `${d} 格`;
  };
  return (
    <main className="exp-app">
      <header className="exp-header">
        <div>
          <p>小小共生镇 · 规则实验</p>
          <h1>从原料到一顿饭</h1>
          <span>
            {fmt(seconds(world))} 秒 · {world.paused ? "已暂停" : "正在观察"}
          </span>
        </div>
        <div className="exp-header-buttons">
          <button
            onClick={() => {
              setHelp(true);
              setWorld((s) => ({ ...s, paused: true }));
            }}
            aria-label="查看实验规则"
          >
            规则
          </button>
          <button onClick={onExit}>回面包房</button>
        </div>
      </header>
      <div className="exp-resources" aria-label="当前资源">
        <span>
          原料{" "}
          <strong>
            {world.stocks.store.grain +
              world.stocks.oven.grain +
              world.workers.reduce(
                (n, w) => n + w.cargo.grain + (w.task?.reserved.grain ?? 0),
                0,
              ) +
              (world.batch?.inputs.grain ?? 0)}
          </strong>
        </span>
        <span>
          电能 <strong>{world.energy}</strong>
        </span>
        <span>
          出炉 <strong>{world.produced}</strong>
        </span>
        <span>
          已吃 <strong>{total.eaten}</strong>
        </span>
      </div>
      <div className="exp-scene" aria-label="可摆放的供给实验场地">
        <SceneBoundary
          onFailure={() => {
            setFailed(true);
            setTab("layout");
          }}
        >
          <Suspense
            fallback={<div className="exp-loading">正在打开实验场地…</div>}
          >
            <ExperimentScene
              world={world}
              selected={selected}
              facility={tab === "layout" ? facility : null}
              labels={!help}
              onPick={pick}
              onPerson={setSelected}
            />
          </Suspense>
        </SceneBoundary>
      </div>
      <section className="exp-panel" aria-label="实验观察与布局">
        <nav className="exp-tabs" aria-label="实验面板">
          <button
            aria-pressed={tab === "observe"}
            onClick={() => setTab("observe")}
          >
            人物与瓶颈
          </button>
          <button
            aria-pressed={tab === "layout"}
            onClick={() => {
              setTab("layout");
              setWorld((s) => ({ ...s, paused: true }));
            }}
          >
            摆放设施
          </button>
          <button
            aria-pressed={tab === "ledger"}
            onClick={() => setTab("ledger")}
          >
            物品账目
          </button>
        </nav>
        <div className="exp-panel-content">
          {tab === "observe" && (
            <>
              <p className="exp-bottleneck">{bottleneck(world)}</p>
              <div className="exp-workers">
                {world.workers.map((w) => (
                  <button
                    key={w.id}
                    className={selected === w.id ? "active" : ""}
                    onClick={() => setSelected(w.id)}
                  >
                    <img
                      src={
                        w.id === "ahe"
                          ? bakeryAssets.ahePortrait
                          : bakeryAssets.xiaomanPortrait
                      }
                      alt=""
                    />
                    <div>
                      <strong>
                        {names[w.id]} · 饥饿 {Math.round(w.hunger)}%
                      </strong>
                      <p>{w.reason}</p>
                      <small>
                        负载 {load(w)}/2 · 吃过 {w.meals} 次 · 走{" "}
                        {fmt(w.walked)} 格
                        {w.task?.started
                          ? ` · 还需 ${fmt(w.task.remaining)} 秒`
                          : ""}
                      </small>
                    </div>
                  </button>
                ))}
              </div>
              <p className="exp-hint">
                试着让他们先吃到一顿饭，再把仓库移近烤炉。谁在搬、谁在等，都由眼前的物品和需求决定。
              </p>
            </>
          )}
          {tab === "layout" && (
            <>
              <div className="exp-facilities">
                {ids.map((id) => (
                  <button
                    key={id}
                    aria-pressed={facility === id}
                    onClick={() => setFacility(id)}
                  >
                    {facilityNames[id]} ({world.layout[id][0] + 1},
                    {world.layout[id][1] + 1})
                  </button>
                ))}
              </div>
              <p className="exp-route-cost">
                仓库→烤炉 {distance("store", "oven")} · 烤炉→餐桌{" "}
                {distance("oven", "table")}
              </p>
              <div className="exp-layout-input">
                <div
                  role="grid"
                  aria-label="设施地格，选中设施后点空地"
                  className="exp-grid"
                  onKeyDown={(e) => {
                    const direction = {
                      ArrowUp: "up",
                      ArrowRight: "right",
                      ArrowDown: "down",
                      ArrowLeft: "left",
                    }[e.key] as "up" | "right" | "down" | "left" | undefined;
                    if (direction) {
                      e.preventDefault();
                      move(facility, direction);
                    }
                  }}
                >
                  {Array.from({ length: 7 }, (_, y) => (
                    <div role="row" key={y}>
                      {Array.from({ length: 9 }, (_, x) => {
                        const id = ids.find(
                          (id) =>
                            world.layout[id][0] === x &&
                            world.layout[id][1] === y,
                        );
                        const wall = walls.some(
                          (p) => p[0] === x && p[1] === y,
                        );
                        return (
                          <button
                            role="gridcell"
                            key={x}
                            disabled={wall}
                            className={
                              wall ? "wall" : id === facility ? "chosen" : ""
                            }
                            aria-label={`第 ${x + 1} 列第 ${y + 1} 行，${wall ? "隔墙" : id ? facilityNames[id] : "空地"}`}
                            aria-selected={id === facility}
                            onClick={() => pick([x, y])}
                          >
                            {wall
                              ? "·"
                              : id
                                ? { store: "仓", oven: "炉", table: "桌" }[id]
                                : ""}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <div
                  className="exp-nudge"
                  aria-label={`移动${facilityNames[facility]}`}
                >
                  <button
                    onClick={() => move(facility, "up")}
                    aria-label="向上移动设施"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => move(facility, "left")}
                    aria-label="向左移动设施"
                  >
                    ←
                  </button>
                  <span>{facilityNames[facility]}</span>
                  <button
                    onClick={() => move(facility, "right")}
                    aria-label="向右移动设施"
                  >
                    →
                  </button>
                  <button
                    onClick={() => move(facility, "down")}
                    aria-label="向下移动设施"
                  >
                    ↓
                  </button>
                </div>
              </div>
              <p className="exp-hint">
                先选设施，再点空地或方向键。移动会暂停实验；货物和在制品保留，继续后重新寻路。
                {failed ? " 当前为地格操作模式。" : ""}
              </p>
            </>
          )}
          {tab === "ledger" && (
            <>
              <div className="exp-stock-list">
                {ids.map((id) => (
                  <div key={id}>
                    <strong>{facilityNames[id]}</strong>
                    <span>
                      原料 {world.stocks[id].grain} · 面包{" "}
                      {world.stocks[id].bread}
                    </span>
                  </div>
                ))}
              </div>
              <p className="exp-hint">
                {total.onSites} 份在设施 + {total.held} 份随身/预留 +{" "}
                {total.inProcess} 份在制 + {total.eaten} 份已吃 = {total.total}{" "}
                份初始物料
              </p>
              <p className="exp-hint">
                电能剩余 {world.energy} + 烘烤已用 {world.energyUsed} ={" "}
                {rules.initialEnergy}
                单位。搬运只转移物品；走路耗时、加重饥饿。
              </p>
              <ol className="exp-events">
                {[...world.events]
                  .reverse()
                  .slice(0, 6)
                  .map((e, i) => (
                    <li key={`${e.tick}-${i}`}>
                      <time>{fmt(e.tick * 0.25)}s</time> {e.text}
                    </li>
                  ))}
              </ol>
            </>
          )}
          {notice && (
            <p className="exp-notice" role="status">
              {notice}
            </p>
          )}
          {previous && <p className="exp-hint">{previous}</p>}
        </div>
      </section>
      <footer className="exp-controls">
        <button
          className="exp-primary"
          onClick={() => {
            setWorld((s) => ({ ...s, paused: !s.paused }));
            setNotice("");
          }}
        >
          {world.paused ? "开始 / 继续" : "暂停"}
        </button>
        <button
          onClick={() => setWorld((s) => observe(s))}
          disabled={!world.paused}
        >
          观察 10 秒
        </button>
        <button
          aria-label={`观察速度 ${speed} 倍，点击切换`}
          onClick={() => setSpeed(speed === 1 ? 4 : 1)}
        >
          {speed}×
        </button>
        <button onClick={() => reset()}>重置同布局</button>
      </footer>
      {help && (
        <div className="exp-overlay">
          <div
            className="exp-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="exp-rules-title"
            ref={dialog}
          >
            <button
              className="exp-close"
              onClick={() => setHelp(false)}
              aria-label="关闭规则"
            >
              ×
            </button>
            <h2 id="exp-rules-title">同一套规则，换一种摆放</h2>
            <p>
              先让阿禾和小满完成搬运、烘烤、送餐和进食。初始只有{" "}
              {rules.initialMaterial} 份备好的原料与 {rules.initialEnergy}{" "}
              单位电能。
            </p>
            <ul>
              <li>
                每人最多携带 2 份；空手走 1.2 格/秒，负重走 0.8
                格/秒。取货、放货各需 1 秒，不能穿过隔墙或设施。
              </li>
              <li>
                一炉消耗 2 份原料、2 单位电能和 6 秒，产出 2
                个面包。烤炉同一时间只有一炉。
              </li>
              <li>
                饥饿每秒增加 0.24%，走路额外耗体力。达到 60%
                且餐桌可达、有食物时优先吃饭；进食需 2 秒，消耗 1 个面包并降低
                42%。已有货物先送妥。
              </li>
              <li>
                其他时候先运出成品，再烘烤，再补充原料。面板实时说明每次判断；等候有具体原因。
              </li>
            </ul>
            <p>
              摆放是暂停时的布局对照，不模拟搬迁建筑本身的施工成本。中途任务保留物品与进度，但必须到新位置才能继续。没有人员碰撞、交易、产权、电网或道德评分；这些资源单位是实验假设。
            </p>
            <button
              onClick={() => {
                reset(true);
                setHelp(false);
              }}
            >
              恢复原始布局
            </button>
            <button className="exp-primary" onClick={() => setHelp(false)}>
              回到观察
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
