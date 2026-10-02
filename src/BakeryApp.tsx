import {
  Component,
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  initialStory,
  getRound,
  availableChoices,
  availableWageModes,
  previewPlan,
  confirmPlan,
  encodeStory,
  decodeStory,
  replayCheckpoint,
  report,
  rounds,
  assumptions,
  characters,
  type StoryState,
  type Plan,
  type CharacterId,
  type Activity,
  type WageMode,
  type Preview,
  type DaySettlement,
} from "./bakery-engine";
import type { BakeryPlace, SceneBeat } from "./BakeryScene";
import "./bakery.css";
import { bakeryAssets } from "./bakery-assets";
const BakeryScene = lazy(() => import("./BakeryScene"));
const GameApp = lazy(() => import("./GameApp"));
const ExperimentApp = lazy(() => import("./ExperimentApp"));
const SAVE = "little-common-bakery-v1";
const money = (v: number) => `¥${(v / 100).toFixed(2)}`;
const activityNames: Record<Activity, string> = {
  rest: "个人时间",
  delivery: "街区配送",
  extra: "接受加单",
};
const symbols: Record<Activity, string> = {
  rest: "◷",
  delivery: "▱",
  extra: "♧",
};
type Phase = "intro" | "meet" | "plan" | "replay" | "result";
type Modal =
  | "menu"
  | "review"
  | "terms"
  | "ledger"
  | "assumptions"
  | "person"
  | "restart"
  | null;
type Draft = { ahe?: Activity; xiaoman?: Activity };
const idleBeat: SceneBeat = {
  ahe: "counter",
  xiaoman: "counter",
  label: "面包房的早晨",
  active: false,
};
function loadState() {
  try {
    const raw = localStorage.getItem(SAVE);
    return raw ? decodeStory(raw) : initialStory();
  } catch {
    return initialStory();
  }
}
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
      <div className="bakery-fallback">
        <strong>这台设备暂时无法显示 3D 面包房</strong>
        <p>
          人物安排、故事与账本仍可使用。可以换一个支持 WebGL
          的浏览器观看他们的行动。
        </p>
      </div>
    ) : (
      this.props.children
    );
  }
}
function portrait(id: CharacterId) {
  return id === "ahe" ? bakeryAssets.ahePortrait : bakeryAssets.xiaomanPortrait;
}
function actionPlace(day: DaySettlement, id: CharacterId): BakeryPlace {
  const p = day.characters[id];
  return p.activity === "delivery"
    ? "delivery"
    : p.activity === "extra"
      ? id === "ahe"
        ? "knead"
        : "oven"
      : p.personalActivity === "study"
        ? "study"
        : "rest";
}
function chime(ctx: AudioContext | null) {
  if (!ctx) return;
  void ctx.resume();
  [523.25, 659.25].forEach((f, i) => {
    const o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = f;
    g.gain.setValueAtTime(0, ctx.currentTime + i * 0.13);
    g.gain.linearRampToValueAtTime(0.025, ctx.currentTime + i * 0.13 + 0.02);
    g.gain.exponentialRampToValueAtTime(
      0.0001,
      ctx.currentTime + i * 0.13 + 0.5,
    );
    o.connect(g);
    g.connect(ctx.destination);
    o.start(ctx.currentTime + i * 0.13);
    o.stop(ctx.currentTime + i * 0.13 + 0.52);
  });
}
export default function BakeryApp() {
  const [story, setStory] = useState(loadState);
  const current = useRef(story);
  const [phase, setPhase] = useState<Phase>(() =>
    story.roundIndex ? "result" : "intro",
  );
  const [draft, setDraft] = useState<Draft>({});
  const [undo, setUndo] = useState<Draft[]>([]);
  const [wage, setWage] = useState<WageMode>("protected");
  const [selected, setSelected] = useState<CharacterId | "wide" | "auto">(
    "ahe",
  );
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [legacy, setLegacy] = useState(false);
  const [experiment, setExperiment] = useState(
    () =>
      new URLSearchParams(window.location.search).get("mode") === "experiment",
  );
  const [sound, setSound] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const [beat, setBeat] = useState<SceneBeat>(idleBeat);
  const [replayStep, setReplayStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [actorsReady, setActorsReady] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(false);
  const mutationEpoch = useRef(0);
  const [compare, setCompare] = useState<StoryState | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const [wageAccepted, setWageAccepted] = useState(false);
  const round = getRound(story);
  const activePerson: CharacterId = selected === "xiaoman" ? "xiaoman" : "ahe";
  const plan: Plan | null =
    draft.ahe && draft.xiaoman
      ? {
          allocations: { ahe: draft.ahe, xiaoman: draft.xiaoman },
          wageMode: wage,
        }
      : null;
  const preview = useMemo(() => {
    if (!plan || !round) return null;
    try {
      return previewPlan(story, plan);
    } catch {
      return null;
    }
  }, [story, draft.ahe, draft.xiaoman, wage]);
  const summary = report(story);
  const lastRound = story.history.at(-1);
  const settledDays = lastRound
    ? story.days.filter((d) => d.roundIndex === lastRound.roundIndex)
    : [];
  const lastDay = settledDays.at(-1);
  useEffect(() => {
    current.current = story;
    try {
      localStorage.setItem(SAVE, encodeStory(story));
    } catch {
      setError("浏览器未能保存进度。请在菜单中导出存档。");
    }
  }, [story]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4200);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const t = setTimeout(
      () => dialog.current?.querySelector<HTMLElement>("button")?.focus(),
      0,
    );
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setModal(null);
        return;
      }
      if (e.key === "Tab") {
        const f = dialog.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input,select,summary,a[href],[tabindex="0"]',
        );
        if (!f?.length) return;
        const first = f[0],
          last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [modal]);
  useEffect(() => {
    if (phase !== "replay" || !lastDay) return;
    setBeat(
      replayStep === 0
        ? {
            ahe: "knead",
            xiaoman: "oven",
            label: "先完成约好的 60 个基础面包",
            active: true,
          }
        : {
            ahe: actionPlace(lastDay, "ahe"),
            xiaoman: actionPlace(lastDay, "xiaoman"),
            label: "接下来，各自去做约好的事",
            active: true,
          },
    );
  }, [phase, replayStep, story]);
  useEffect(() => {
    if (
      phase !== "replay" ||
      paused ||
      !lastDay ||
      (!actorsReady && !sceneFailed)
    )
      return;
    const t = setTimeout(() => {
      if (replayStep === 0) {
        setActorsReady(false);
        setReplayStep(1);
      } else {
        setPhase("result");
        if (sound) chime(audio.current);
      }
    }, 2200);
    return () => clearTimeout(t);
  }, [phase, replayStep, paused, actorsReady, sceneFailed, story, sound]);
  useEffect(() => {
    if (phase === "result" && lastDay)
      setBeat({
        ahe: actionPlace(lastDay, "ahe"),
        xiaoman: actionPlace(lastDay, "xiaoman"),
        label: "已完成安排",
        active: false,
      });
  }, [phase, story]);
  function select(id: CharacterId) {
    setSelected(id);
    if (phase === "intro" || phase === "meet") return;
    if (phase === "result") setModal("person");
  }
  function choose(activity: Activity) {
    if (!round) return;
    const choice = availableChoices(story, activePerson).find(
      (c) => c.id === activity,
    );
    if (!choice?.available) {
      setToast(choice?.reason ?? "这个安排暂不可用");
      return;
    }
    setUndo([...undo, draft]);
    setDraft({ ...draft, [activePerson]: activity });
    if (sound) chime(audio.current);
    if (activePerson === "ahe" && !draft.xiaoman) setSelected("xiaoman");
  }
  function startPlanning() {
    setPhase("plan");
    setDraft({});
    setUndo([]);
    setWage("protected");
    setSelected("ahe");
    setBeat(idleBeat);
    setError("");
  }
  function confirm() {
    if (!plan || !preview || !round) return;
    try {
      const next = confirmPlan(current.current, plan, round.index);
      if (next === current.current) return;
      mutationEpoch.current++;
      current.current = next;
      setStory(next);
      setModal(null);
      setSelected("auto");
      setActorsReady(false);
      setReplayStep(0);
      setPaused(false);
      setPhase("replay");
      setError("");
      if (sound) chime(audio.current);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function rewind(n: number) {
    if (story.completed) setCompare(story);
    mutationEpoch.current++;
    const next = replayCheckpoint(story, n);
    current.current = next;
    setStory(next);
    setModal(null);
    startPlanning();
  }
  function toggleSound() {
    if (!sound) {
      try {
        audio.current ??= new AudioContext();
        chime(audio.current);
        setSound(true);
      } catch {
        setToast("当前浏览器无法启用声音");
      }
    } else setSound(false);
  }
  function exportSave() {
    const blob = new Blob([encodeStory(story)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "面包出炉以后-存档.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importSave(file: File | undefined) {
    if (!file) return;
    const epoch = ++mutationEpoch.current;
    try {
      const raw = await file.text();
      if (epoch !== mutationEpoch.current) return;
      const next = decodeStory(raw);
      current.current = next;
      setStory(next);
      setPhase(next.roundIndex ? "result" : "intro");
      setModal(null);
      setDraft({});
      setSelected("wide");
      setBeat(idleBeat);
      setError("");
      setToast("已恢复到最近一次确认的安排");
    } catch (e) {
      if (epoch !== mutationEpoch.current) return;
      setError((e as Error).message);
    }
  }
  const selectPlace = (place: BakeryPlace) => {
    const texts: Record<BakeryPlace, string> = {
      knead: "阿禾的揉面台",
      oven: "小满照看的烤炉",
      machine: "同样的 60 个面包：8 工时变 4 工时。本章的固定假设。",
      counter: "今天的基础订单：60 个面包，单价 ¥6。",
      rest: "个人时间可以在小院里慢慢度过。",
      study: "这里是免费的社区课堂，学习不会自动变成收入。",
      delivery: "配送服务收费另计，不重复计算面包销售。",
    };
    setToast(texts[place]);
  };
  function enterExperiment() {
    setModal(null);
    setPaused(true);
    setExperiment(true);
    const url = new URL(window.location.href);
    url.searchParams.set("mode", "experiment");
    window.history.replaceState(null, "", url);
  }
  if (experiment)
    return (
      <Suspense fallback={<p>正在打开规则实验…</p>}>
        <ExperimentApp
          onExit={() => {
            setExperiment(false);
            const url = new URL(window.location.href);
            url.searchParams.delete("mode");
            window.history.replaceState(null, "", url);
          }}
        />
      </Suspense>
    );
  if (legacy)
    return (
      <>
        <Suspense fallback={<p>正在打开小镇…</p>}>
          <GameApp />
        </Suspense>
        <button className="bakery-back" onClick={() => setLegacy(false)}>
          回到面包房
        </button>
      </>
    );
  return (
    <div className="bakery-app">
      <div className="bakery-scene">
        <SceneBoundary onFailure={() => setSceneFailed(true)}>
          <Suspense
            fallback={<div className="bakery-fallback">正在打开面包房…</div>}
          >
            <BakeryScene
              beat={beat}
              selected={selected}
              onSelect={select}
              onPlace={selectPlace}
              evening={phase === "result"}
              onReady={() => setActorsReady(true)}
              labels={!modal}
              paused={phase === "replay" && paused}
            />
          </Suspense>
        </SceneBoundary>
      </div>
      <div className="bakery-vignette" />
      <div className="bakery-hud">
        <div className="bakery-day">
          <small>小小共生镇 · 第一章</small>
          <strong>
            {phase === "intro" || phase === "meet"
              ? "面包出炉以后"
              : phase === "result" || phase === "replay"
                ? `第 ${lastDay?.day ?? 1} 天${story.completed ? " · 一周回望" : ""}`
                : `第 ${round?.days[0]}${round && round.days.length > 1 ? `—${round.days.at(-1)}` : ""} 天`}
          </strong>
        </div>
        <div className="bakery-hud-actions">
          <button
            className="bakery-round-btn"
            aria-label="看整个面包房"
            title="看整个面包房"
            onClick={() => setSelected("wide")}
          >
            ⌂
          </button>
          <button
            className="bakery-round-btn bakery-audio"
            aria-label={sound ? "关闭声音" : "开启声音"}
            onClick={toggleSound}
          >
            {sound ? "声开" : "声关"}
          </button>
          <button
            className="bakery-round-btn"
            aria-label="打开菜单"
            onClick={() => setModal("menu")}
          >
            ☰
          </button>
        </div>
      </div>
      <div className="bakery-status" aria-live="polite">
        {phase === "replay"
          ? beat.label
          : phase === "plan"
            ? round?.subtitle
            : phase === "result"
              ? "这一页已记入账本"
              : phase === "meet"
                ? "先认识一起工作的人"
                : "清晨，第一炉面包出炉了"}
      </div>
      {toast && (
        <div className="bakery-toast" role="status">
          {toast}
        </div>
      )}
      <section
        className={`bakery-tray ${phase === "result" ? "bakery-compact-report" : ""}`}
        aria-label="面包房故事与行动"
      >
        {phase === "intro" && (
          <>
            <p className="bakery-eyebrow">七天 · 四次安排 · 两个人的下午</p>
            <h1>
              面包没有少，
              <br />
              时间多出来了
            </h1>
            <p className="bakery-copy">
              镇上借来一台揉面机。同样一炉面包，阿禾和小满各省下两小时。这个下午，怎么过？
            </p>
            <div className="bakery-intro-facts">
              <span>
                <strong>8 工时</strong>原先每天
              </span>
              <i>→</i>
              <span>
                <strong>4 工时</strong>机器协助以后
              </span>
            </div>
            <div className="bakery-footer-row">
              <span>一个虚构的小镇故事</span>
              <button
                className="bakery-primary"
                onClick={() => {
                  setPhase("meet");
                  setSelected("ahe");
                }}
              >
                去面包房看看
              </button>
            </div>
            <button className="bakery-text-btn" onClick={enterExperiment}>
              试试搬运与供给规则实验
            </button>
          </>
        )}
        {phase === "meet" && (
          <>
            <p className="bakery-eyebrow">先听听他们</p>
            <h2>一起做面包，也一起商量</h2>
            <div className="bakery-character-row">
              {characters.map((c) => (
                <button
                  key={c.id}
                  className={`bakery-character ${activePerson === c.id ? "active" : ""}`}
                  onClick={() => setSelected(c.id)}
                >
                  <img src={portrait(c.id)} alt="" />
                  <span>
                    <strong>{c.name}</strong>
                    <small>{c.role}</small>
                  </span>
                </button>
              ))}
            </div>
            <p className="bakery-copy">
              {activePerson === "ahe"
                ? "阿禾喜欢烘焙，也惦记着社区课堂。她想知道，省下来的时间能不能留一点给自己。"
                : "小满熟悉街坊，也乐意试新路线。不过她会说出哪些工作今天愿意做，哪些不愿意。"}
            </p>
            <div className="bakery-footer-row">
              <span>原工资：每人每天 ¥80</span>
              <button className="bakery-primary" onClick={startPlanning}>
                听听今天的打算
              </button>
            </div>
          </>
        )}
        {phase === "plan" && round && (
          <>
            <div className="bakery-planning-title">
              <h2>省下的 4 小时，怎么安排？</h2>
              <span className="bakery-hour-badge">
                {(!!draft.ahe ? 2 : 0) + (!!draft.xiaoman ? 2 : 0)} / 4 小时
              </span>
            </div>
            <div className="bakery-character-row">
              {characters.map((c) => (
                <button
                  key={c.id}
                  className={`bakery-character ${activePerson === c.id ? "active" : ""}`}
                  aria-pressed={activePerson === c.id}
                  onClick={() => setSelected(c.id)}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", c.id);
                    setSelected(c.id);
                  }}
                >
                  <img src={portrait(c.id)} alt="" />
                  <span>
                    <strong>
                      {c.name}
                      <small>
                        {draft[c.id]
                          ? `${activityNames[draft[c.id]!]} · 2小时`
                          : "点选，安排 2 小时"}
                      </small>
                    </strong>
                  </span>
                </button>
              ))}
            </div>
            <p className="bakery-quote">
              <strong>{activePerson === "ahe" ? "阿禾" : "小满"}：</strong>“
              {round.preferences[activePerson].quote}”
            </p>
            <div className="bakery-choice-grid">
              {availableChoices(story, activePerson).map((c) => (
                <button
                  key={c.id}
                  className={`bakery-choice ${draft[activePerson] === c.id ? "chosen" : ""}`}
                  aria-pressed={draft[activePerson] === c.id}
                  aria-disabled={!c.available}
                  onClick={() => choose(c.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData(
                      "text/plain",
                    ) as CharacterId;
                    if (id !== "ahe" && id !== "xiaoman") return;
                    const choice = availableChoices(story, id).find(
                      (x) => x.id === c.id,
                    );
                    if (!choice?.available) {
                      setToast(choice?.reason ?? "");
                      return;
                    }
                    setUndo([...undo, draft]);
                    setDraft({ ...draft, [id]: c.id });
                    setSelected(id);
                  }}
                >
                  <span className="choice-symbol" aria-hidden="true">
                    {symbols[c.id]}
                  </span>
                  <strong>{c.label}</strong>
                  <small className={!c.available ? "unavailable" : ""}>
                    {!c.available
                      ? "今天不愿意"
                      : c.id === "rest"
                        ? round.preferences[activePerson].personalActivity ===
                          "study"
                          ? "社区课堂 · 2小时"
                          : "自己的下午 · 2小时"
                        : c.id === "delivery"
                          ? "最多 6 单 / 天"
                          : "最多 12 个 / 天"}
                  </small>
                  {draft[activePerson] === c.id && (
                    <span className="choice-tick">✓</span>
                  )}
                </button>
              ))}
            </div>
            <div className="bakery-plan-footer">
              <button
                className="bakery-text-btn"
                disabled={!undo.length}
                onClick={() => {
                  setDraft(undo.at(-1)!);
                  setUndo(undo.slice(0, -1));
                }}
              >
                撤销
              </button>
              <button
                className="bakery-text-btn"
                onClick={() => {
                  setWageAccepted(false);
                  setModal("terms");
                }}
              >
                {wage === "protected" ? "工资照旧" : "按工时计薪"}
              </button>
              <button
                className="bakery-primary"
                disabled={!preview}
                onClick={() => setModal("review")}
              >
                看看这样安排
              </button>
            </div>
            <p className="bakery-prompt">
              先点一个人，再点去处。确认前都能修改；本轮安排用于第{" "}
              {round.days.join("、")} 天。
            </p>
          </>
        )}
        {phase === "replay" && (
          <>
            <p className="bakery-eyebrow">
              已确认 · 回放本轮最后一天的实际安排
            </p>
            <h2>
              {replayStep === 0 ? "第一炉，照常出炉" : "两个下午，各有去处"}
            </h2>
            <p className="bakery-copy">
              {replayStep === 0
                ? "揉面机接下重复的工序，两个人各完成两小时基础工作。"
                : `${lastDay?.characters.ahe.dialogue} ${lastDay?.characters.xiaoman.dialogue}`}
            </p>
            <div className="bakery-progress">
              <span className="done" />
              <span className={replayStep ? "done" : ""} />
            </div>
            <div className="bakery-footer-row">
              <button onClick={() => setPaused(!paused)}>
                {paused ? "继续观看" : "暂停回放"}
              </button>
              <button
                className="bakery-primary"
                onClick={() => {
                  if (lastDay)
                    setBeat({
                      ahe: actionPlace(lastDay, "ahe"),
                      xiaoman: actionPlace(lastDay, "xiaoman"),
                      label: "已完成安排",
                      active: false,
                    });
                  setPhase("result");
                }}
              >
                看看这次的结果
              </button>
            </div>
          </>
        )}
        {phase === "result" && lastDay && (
          <>
            <p className="bakery-eyebrow">
              {story.completed
                ? "第7天 · 这一周，没有标准答案"
                : `第 ${settledDays.map((d) => d.day).join("、")} 天 · 已经发生`}
            </p>
            <h2>
              {story.completed
                ? "你想保留哪一项结果？"
                : "面包出炉以后，他们去了哪里"}
            </h2>
            <div className="bakery-report-cards">
              <div>
                <strong>
                  {story.completed
                    ? summary.personalHours
                    : settledDays.reduce(
                        (s, d) =>
                          s +
                          d.characters.ahe.personalHours +
                          d.characters.xiaoman.personalHours,
                        0,
                      )}
                  h
                </strong>
                <small>留给自己的时间</small>
              </div>
              <div>
                <strong>
                  {story.completed
                    ? summary.deliveryStops
                    : settledDays.reduce((s, d) => s + d.deliveryStops, 0)}{" "}
                  单
                </strong>
                <small>送到街坊手中</small>
              </div>
              <div>
                <strong>
                  {story.completed
                    ? summary.extraLoaves
                    : settledDays.reduce((s, d) => s + d.extraLoaves, 0)}{" "}
                  个
                </strong>
                <small>额外面包</small>
              </div>
            </div>
            {characters.map((c) => (
              <button
                className="bakery-report-line"
                key={c.id}
                onClick={() => {
                  setSelected(c.id);
                  setModal("person");
                }}
                aria-label={`查看${c.name}的这一周`}
              >
                <img src={portrait(c.id)} alt="" />
                <span>
                  <strong>{c.name}：</strong>
                  {story.completed
                    ? `个人时间 ${summary.characters[c.id].personalHours}h，收入 ${money(summary.characters[c.id].wagesCents)}`
                    : lastDay.characters[c.id].dialogue}
                </span>
              </button>
            ))}
            <div className="bakery-footer-row">
              <button onClick={() => setModal("ledger")}>
                翻开账本 · {money(story.cashCents)}
              </button>
              <button
                className="bakery-primary"
                onClick={() =>
                  story.completed ? setModal("restart") : startPlanning()
                }
              >
                {story.completed ? "换一种安排" : "翻到下一天"}
              </button>
            </div>
            {compare && story.completed && (
              <p className="bakery-prompt">
                与上次同一起点相比：个人时间{" "}
                {summary.personalHours - report(compare).personalHours >= 0
                  ? "+"
                  : ""}
                {summary.personalHours - report(compare).personalHours}
                h，店里现金{" "}
                {money(
                  summary.closingCashCents - report(compare).closingCashCents,
                )}
                。
              </p>
            )}
          </>
        )}
        {error && (
          <p className="bakery-error-note" role="alert">
            {error}
          </p>
        )}
      </section>
      {modal && (
        <div
          className="bakery-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <div
            ref={dialog}
            className="bakery-modal"
            role="dialog"
            aria-modal="true"
            aria-label={modal === "review" ? "确认安排" : "面包房详情"}
          >
            <button
              className="bakery-close"
              aria-label="关闭弹窗"
              onClick={() => setModal(null)}
            >
              ×
            </button>
            {modal === "menu" && (
              <>
                <p className="bakery-eyebrow">面包出炉以后</p>
                <h2>小镇手册</h2>
                <div className="bakery-menu-items">
                  <button onClick={enterExperiment}>
                    打开搬运与供给规则实验
                  </button>
                  <button onClick={() => setModal("ledger")}>
                    看看时间与账本
                  </button>
                  <button onClick={() => setModal("assumptions")}>
                    这个故事怎样运转
                  </button>
                  <button onClick={exportSave}>导出故事存档</button>
                  <label className="bakery-consent">
                    导入故事存档
                    <input
                      type="file"
                      accept="application/json,.json"
                      onChange={(e) => {
                        void importSave(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <button onClick={() => setModal("restart")}>
                    从检查点换一种安排
                  </button>
                  <button
                    onClick={() => {
                      setModal(null);
                      setLegacy(true);
                    }}
                  >
                    打开原来的小镇与沙盒
                  </button>
                </div>
                <p>
                  进度保存在当前浏览器。每一次确认会同时记下钱、时间和两人的意愿。
                </p>
              </>
            )}
            {modal === "review" && preview && round && (
              <>
                <p className="bakery-eyebrow">预演 · 尚未执行</p>
                <h2>第 {round.days.join("、")} 天，就这样过？</h2>
                {characters.map((c) => (
                  <div className="bakery-review-person" key={c.id}>
                    <img src={portrait(c.id)} alt="" />
                    <div>
                      <strong>
                        {c.name} ·{" "}
                        {activityNames[preview.plan.allocations[c.id]]}
                      </strong>
                      <p>
                        每天 2 小时；本轮收入{" "}
                        {money(preview.characters[c.id].wagesCents)}
                      </p>
                    </div>
                  </div>
                ))}
                <div className="bakery-report-cards">
                  <div>
                    <strong>
                      {preview.characters.ahe.personalHours +
                        preview.characters.xiaoman.personalHours}
                      h
                    </strong>
                    <small>预计个人时间</small>
                  </div>
                  <div>
                    <strong>
                      {preview.days.reduce((n, d) => n + d.deliveryStops, 0)} 单
                    </strong>
                    <small>预计配送</small>
                  </div>
                  <div>
                    <strong>
                      {preview.days.reduce((n, d) => n + d.extraLoaves, 0)} 个
                    </strong>
                    <small>预计额外面包</small>
                  </div>
                </div>
                <PreviewMath preview={preview} />
                <p>
                  基础面包每天 60
                  个。加单与配送按当天的需求结算，超过需求不会凭空增加收入。
                </p>
                <button className="bakery-primary" onClick={confirm}>
                  照这个安排开工
                </button>
                <button
                  className="bakery-text-btn"
                  onClick={() => setModal(null)}
                >
                  再想一想
                </button>
              </>
            )}
            {modal === "terms" && round && (
              <>
                <p className="bakery-eyebrow">先把约定说清楚</p>
                <h2>省下时间，工资怎么算？</h2>
                {availableWageModes(story).map((w) => (
                  <div className="bakery-consent" key={w.id}>
                    <strong>{w.label}</strong>
                    <p>{w.description}</p>
                    {!w.available && <p>{w.reason}</p>}
                    {w.id === "protected" && (
                      <button
                        onClick={() => {
                          setWage("protected");
                          setModal(null);
                        }}
                      >
                        维持每人每天 ¥80
                      </button>
                    )}
                  </div>
                ))}
                {availableWageModes(story).some(
                  (w) => w.id === "hourly" && w.available,
                ) && (
                  <>
                    <p>阿禾：“{round.preferences.ahe.wageQuote}”</p>
                    <p>小满：“{round.preferences.xiaoman.wageQuote}”</p>
                    <label className="bakery-consent">
                      <input
                        type="checkbox"
                        checked={wageAccepted}
                        onChange={(e) => setWageAccepted(e.target.checked)}
                      />
                      我已看清：个人时间不计薪，只试行今天
                    </label>
                    <button
                      className="bakery-primary"
                      disabled={!wageAccepted}
                      onClick={() => {
                        setWage("hourly");
                        setModal(null);
                      }}
                    >
                      采用今天的新约定
                    </button>
                  </>
                )}
              </>
            )}
            {modal === "assumptions" && (
              <>
                <p className="bakery-eyebrow">虚构场景的边界</p>
                <h2>先把规则摆在桌上</h2>
                {assumptions.map((a, i) => (
                  <p key={i}>{a}</p>
                ))}
              </>
            )}
            {modal === "person" && (
              <>
                <img
                  src={portrait(activePerson)}
                  width="100"
                  height="110"
                  alt=""
                />
                <h2>{activePerson === "ahe" ? "阿禾" : "小满"}的这一周</h2>
                <p>
                  基础工作 {story.days.length * 2} 小时；个人时间{" "}
                  {summary.characters[activePerson].personalHours}{" "}
                  小时，其中学习 {summary.characters[activePerson].studyHours}{" "}
                  小时。
                </p>
                <p>
                  已领工资 {money(summary.characters[activePerson].wagesCents)}
                  。配送 {summary.characters[activePerson].deliveryStops}{" "}
                  单，加做 {summary.characters[activePerson].extraLoaves}{" "}
                  个面包。
                </p>
                <p>{lastDay?.characters[activePerson].dialogue}</p>
              </>
            )}
            {modal === "restart" && (
              <>
                <p className="bakery-eyebrow">同一起点，再试一次</p>
                <h2>哪一页，想重新写？</h2>
                <p>
                  回到该轮确认之前，现金、日期与需求都会还原。当前结果暂留作对照。
                </p>
                <div className="bakery-menu-items">
                  {rounds
                    .filter((r) => r.index <= story.history.length)
                    .map((r) => (
                      <button key={r.index} onClick={() => rewind(r.index)}>
                        {r.subtitle} · {r.title}
                      </button>
                    ))}
                </div>
              </>
            )}
            {modal === "ledger" && (
              <>
                <p className="bakery-eyebrow">
                  实际结算 · 已度过 {summary.daysCompleted} 天
                </p>
                <h2>钱与时间，都有去处</h2>
                <dl className="bakery-review-math">
                  <dt>期初现金</dt>
                  <dd>{money(summary.openingCashCents)}</dd>
                  <dt>销售与配送收入</dt>
                  <dd>+{money(summary.revenueCents)}</dd>
                  <dt>原料、运行、配送与工资</dt>
                  <dd>−{money(summary.costCents)}</dd>
                  <dt className="total">店里现金</dt>
                  <dd className="total">{money(summary.closingCashCents)}</dd>
                </dl>
                <p>
                  机器腾出 {summary.freedHours} 工时：{summary.personalHours}{" "}
                  小时留给个人，{summary.commercialHours} 小时用于配送或加单。
                </p>
                {characters.map((c) => (
                  <p key={c.id}>
                    {c.name}：工作 {summary.characters[c.id].workedHours}h，计薪{" "}
                    {summary.characters[c.id].paidHours}h，收入{" "}
                    {money(summary.characters[c.id].wagesCents)}。
                  </p>
                ))}
                {story.days.map((d) => (
                  <details key={d.day}>
                    <summary>
                      第 {d.day} 天 · 净变化 {money(d.deltaCents)}
                    </summary>
                    <table className="bakery-ledger">
                      <thead>
                        <tr>
                          <th>项目</th>
                          <th>金额</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.ledger.map((e) => (
                          <tr key={e.id}>
                            <td>{e.label}</td>
                            <td>
                              {e.amountCents >= 0 ? "+" : ""}
                              {money(e.amountCents)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p>
                      基础 {d.baseLoaves} 个，加单 {d.extraLoaves}/
                      {d.extraDemand} 个；配送 {d.deliveryStops}/
                      {d.deliveryDemand} 单。
                    </p>
                  </details>
                ))}
                <p>本账本包含本周现金流，不包含购机、租金、税与长期成本。</p>
                <button onClick={() => setModal("assumptions")}>
                  查看完整场景假设
                </button>
              </>
            )}
            {error && (
              <p className="bakery-error-note" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
function PreviewMath({ preview }: { preview: Preview }) {
  const income = preview.days.reduce((s, d) => s + d.revenueCents, 0);
  const cost = preview.days.reduce((s, d) => s + d.costCents, 0);
  return (
    <dl className="bakery-review-math">
      <dt>当前现金</dt>
      <dd>{money(preview.beforeCashCents)}</dd>
      <dt>本轮预计收入</dt>
      <dd>+{money(income)}</dd>
      <dt>本轮原料、运行与工资等</dt>
      <dd>−{money(cost)}</dd>
      <dt className="total">预计店里剩下</dt>
      <dd className="total">{money(preview.afterCashCents)}</dd>
    </dl>
  );
}
