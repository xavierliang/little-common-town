import React, { useEffect, useRef, useState, Component } from "react";

import TownScene from "./TownScene";
import { registerTownReader } from "./webmcp";
import {
  createTown,
  stepTown,
  applyCommand,
  metrics,
  serialize,
  deserialize,
  comparePolicies,
  type TownState,
  type Policy,
  type Role,
} from "./sim";
import "./style.css";
const money = (v: number) => `¥${(v / 100).toFixed(2)}`;
const STORE = "little-common-town-v1";
class SceneBoundary extends Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="scene-error">
        <span>小镇的 3D 画面暂时没有加载成功</span>
        <p>请确认浏览器已开启 WebGL，然后刷新。右侧经济模拟仍可使用。</p>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function Sandbox() {
  const [town, setTown] = useState<TownState>(() =>
    createTown("little-common-01"),
  );
  const [running, setRunning] = useState(false),
    [speed, setSpeed] = useState(1),
    [selected, setSelected] = useState(""),
    [mode, setMode] = useState<"observer" | "mayor" | "resident">("observer"),
    [tab, setTab] = useState<"person" | "policy" | "ledger">("person");
  const [message, setMessage] = useState(
    "欢迎来到小小共生镇。按下播放，看看第一天会发生什么。",
  );
  const [comparison, setComparison] = useState<ReturnType<
    typeof comparePolicies
  > | null>(null);
  const [help, setHelp] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const accumulator = useRef(0);
  const importGeneration = useRef(0);
  const latestTown = useRef(town);
  latestTown.current = town;
  useEffect(() => registerTownReader(() => latestTown.current), []);
  useEffect(() => {
    if (!running) return;
    let last = performance.now(),
      frame = 0;
    function tick(now: number) {
      accumulator.current += Math.min((now - last) / 1000, 0.25) * speed;
      last = now;
      let steps = 0;
      while (accumulator.current >= 3 && steps < 8) {
        accumulator.current -= 3;
        steps++;
      }
      if (steps)
        setTown((s) => {
          let next = s;
          try {
            for (let i = 0; i < steps; i++) next = stepTown(next);
          } catch (error) {
            queueMicrotask(() => {
              setRunning(false);
              setMessage(
                `模拟已安全暂停：${error instanceof Error ? error.message : "状态校验失败"}`,
              );
            });
          }
          return next;
        });
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, speed]);
  useEffect(() => {
    if (!help) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setHelp(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [help]);
  const m = metrics(town);
  const person =
    town.residents.find((r) => r.id === selected) || town.residents[0];
  const role: Role =
    mode === "resident"
      ? { type: "resident", residentId: person.id }
      : { type: mode };
  const household = town.households.find((h) => h.id === person.householdId);
  const employer = town.firms.find((f) => f.id === person.employerId);
  function changePolicy(p: Partial<Policy>) {
    try {
      setTown(applyCommand(town, { type: "setPolicy", policy: p }, role));
      setComparison(null);
      setMessage("政策已更新，将影响接下来的模拟日。");
    } catch (e) {
      setMessage(String(e));
    }
  }
  function save() {
    try {
      localStorage.setItem(STORE, serialize(town));
      setMessage(`第 ${town.day} 天的存档已保存在此浏览器`);
    } catch {
      setMessage("浏览器存储不可用，请使用导出存档");
    }
  }
  function restore() {
    importGeneration.current++;
    if (input.current) input.current.value = "";
    try {
      const raw = localStorage.getItem(STORE);
      if (!raw) throw Error("此浏览器没有存档");
      setTown(deserialize(raw));
      setRunning(false);
      accumulator.current = 0;
      setComparison(null);
      setMessage("存档已读取，模拟已暂停");
    } catch (e) {
      setMessage(`无法读取：${e instanceof Error ? e.message : "存档无效"}`);
    }
  }
  function exportSave() {
    const a = document.createElement("a");
    const url = URL.createObjectURL(
      new Blob([serialize(town)], { type: "application/json" }),
    );
    a.href = url;
    a.download = `little-common-day-${town.day}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("存档已导出为 JSON 文件");
  }
  async function importSave(file?: File) {
    if (!file) return;
    const generation = ++importGeneration.current;
    try {
      if (file.size > 25_000_000) throw Error("文件超过 25MB");
      const raw = await file.text();
      if (generation !== importGeneration.current) return;
      const next = deserialize(raw);
      setTown(next);
      setRunning(false);
      accumulator.current = 0;
      setComparison(null);
      setMessage("导入成功，模拟已暂停");
    } catch (e) {
      if (generation !== importGeneration.current) return;
      setMessage(`导入失败：${e instanceof Error ? e.message : "无效存档"}`);
    } finally {
      if (generation === importGeneration.current && input.current)
        input.current.value = "";
    }
  }
  function citizenAction(kind: "work" | "rest" | "food") {
    try {
      const next = applyCommand(
        town,
        kind === "food"
          ? { type: "buyFood", residentId: person.id, quantity: 1 }
          : {
              type: "setWorkPreference",
              residentId: person.id,
              preference: kind,
            },
        role,
      );
      setTown(next);
      setMessage(
        kind === "food"
          ? "已尝试购买 1 份食物，请查看库存和账本"
          : "工作意愿已更新",
      );
    } catch (e) {
      setMessage(String(e));
    }
  }
  return (
    <div className="app">
      <header>
        <div className="brand">
          <div className="brand-icon">⌂</div>
          <div>
            <h1>
              小小共生镇 <span>Little Common</span>
            </h1>
            <p>一座关于生活、劳动与分配的小小实验场</p>
          </div>
        </div>
        <div className="top-actions">
          <span className="prototype">可玩原型 · 01</span>
          <button onClick={() => setHelp(true)}>玩法与假设 ↗</button>
        </div>
      </header>
      <main>
        <section className="world">
          <div className="world-top">
            <div className="day">
              <span className="sun">☀</span>
              <div>
                <small>小镇日历</small>
                <strong>第 {town.day} 天</strong>
              </div>
              <span className="weather">晴 · 每一天都是新的开始</span>
            </div>
            <div className="mode-picker" aria-label="角色模式">
              {(
                [
                  ["observer", "观察者"],
                  ["mayor", "镇长"],
                  ["resident", "居民"],
                ] as const
              ).map(([id, label]) => (
                <button
                  className={mode === id ? "active" : ""}
                  onClick={() => {
                    setMode(id);
                    if (id === "mayor") setTab("policy");
                    else setTab("person");
                  }}
                  key={id}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="canvas">
            <SceneBoundary>
              <TownScene
                state={town}
                selected={person.id}
                onSelect={(id) => {
                  setSelected(id);
                  setTab("person");
                }}
                running={running}
              />
            </SceneBoundary>
          </div>
          <div className="world-caption">
            <span>
              <i /> {running ? "小镇正在运转" : "时光暂时停在这里"}
            </span>
            <span>拖动旋转 · 滚轮缩放 · 点击居民</span>
          </div>
          <div className="transport">
            <button className="play" onClick={() => setRunning((v) => !v)}>
              {running ? "Ⅱ 暂停" : "▶ 开始生活"}
            </button>
            <button
              className="step"
              onClick={() => {
                try {
                  setTown(stepTown(town));
                } catch (error) {
                  setMessage(
                    `模拟已安全暂停：${error instanceof Error ? error.message : "状态校验失败"}`,
                  );
                }
                setRunning(false);
                accumulator.current = 0;
              }}
            >
              前进一天 →
            </button>
            <div className="speed">
              {[1, 2, 4].map((n) => (
                <button
                  key={n}
                  className={speed === n ? "active" : ""}
                  onClick={() => setSpeed(n)}
                >
                  {n}×
                </button>
              ))}
            </div>
            <span className="fixed-note">固定日步长 · 1× = 3 秒 / 天</span>
          </div>
          <div className="stats">
            <Stat
              label="平均生活状态"
              value={`${Math.round(m.averageWellbeing)}`}
              suffix="/ 100"
              trend="由食物与休息共同影响"
            />
            <Stat
              label="就业人数"
              value={`${m.employed}`}
              suffix={`/ ${m.population}`}
              trend="工作意愿与岗位匹配"
            />
            <Stat
              label="今日食物产量"
              value={`${m.producedToday}`}
              suffix="份"
              trend={`消费 ${m.consumedToday} 份 · 库存 ${m.totalInventory}`}
            />
            <Stat
              label="公共账户余额"
              value={money(m.treasuryCents)}
              trend={`今日税收 ${money(m.taxRevenueCents)}`}
            />
          </div>
          <section className="bottom-card">
            <div className="section-heading">
              <div>
                <small>THE TOWN PULSE</small>
                <h2>小镇近况</h2>
              </div>
              <span className="integrity">
                {m.moneyConserved && m.ledgerBalanced
                  ? "✓ 资金守恒 · 账本平衡"
                  : "⚠ 账目需要检查"}
              </span>
            </div>
            <div className="feed">
              {town.events
                .slice(-3)
                .reverse()
                .map((e) => (
                  <div key={e.id}>
                    <span className="event-day">DAY {e.day}</span>
                    <p>{e.message}</p>
                  </div>
                ))}
              {!town.events.length && (
                <p className="muted">
                  16 位居民、8 个家庭、2 家食品企业。第一天的故事还没有开始。
                </p>
              )}
            </div>
          </section>
        </section>
        <aside>
          <nav className="tabs">
            {(
              [
                ["person", "居民档案"],
                ["policy", "小镇政策"],
                ["ledger", "经济账本"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={tab === id ? "active" : ""}
              >
                {label}
              </button>
            ))}
          </nav>
          {tab === "person" && (
            <>
              <div className="person-heading">
                <div className="avatar">☺</div>
                <div>
                  <small>
                    镇民 · {town.residents.indexOf(person) + 1} / 16
                  </small>
                  <h2>{person.name}</h2>
                  <span>
                    {employer?.name || "暂无工作"} ·{" "}
                    {person.workPreference === "rest" ? "希望休息" : "愿意工作"}
                  </span>
                </div>
                <select
                  aria-label="选择居民"
                  value={person.id}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  {town.residents.map((r) => (
                    <option value={r.id} key={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="quote">
                今天的生活，从一顿好饭开始。
                <small>氛围文案，非居民内心推断</small>
              </div>
              <div className="needs">
                <Meter
                  label="生活状态"
                  value={person.wellbeing}
                  color="#76a58d"
                />
                <Meter label="精力" value={person.energy} color="#e6b46c" />
                <Meter label="饥饿程度" value={person.hunger} color="#dc917c" />
              </div>
              <div className="facts">
                <Fact
                  label="个人账户"
                  value={money(
                    town.accounts[person.accountId]?.balanceCents || 0,
                  )}
                />
                <Fact label="个人食物" value={`${person.food} 份`} />
                <Fact label="今日收入" value={money(person.lastIncomeCents)} />
                <Fact label="今日支出" value={money(person.lastSpentCents)} />
                <Fact
                  label="家庭编号"
                  value={household?.id || person.householdId}
                />
                <Fact label="劳动技能" value={person.skill.toFixed(2)} />
              </div>
              <div className="resident-actions">
                <h3>生活选择</h3>
                <p>
                  {mode === "resident"
                    ? "你正在扮演当前选中的居民。"
                    : "切换到居民模式，决定当前居民的工作意愿或购买食物。"}
                </p>
                <div>
                  <button
                    disabled={mode !== "resident"}
                    onClick={() => citizenAction("work")}
                  >
                    愿意工作
                  </button>
                  <button
                    disabled={mode !== "resident"}
                    onClick={() => citizenAction("rest")}
                  >
                    暂停工作
                  </button>
                  <button
                    disabled={mode !== "resident"}
                    onClick={() => citizenAction("food")}
                  >
                    购买食物
                  </button>
                </div>
              </div>
              <div className="note">
                <span>✦</span>
                <p>
                  居民走动是示意动画。工作、购买和消费按照每天一次的经济规则结算。
                </p>
              </div>
            </>
          )}
          {tab === "policy" && (
            <div className="policy-content">
              <small>MAYOR’S DESK</small>
              <h2>把小镇调成你想的样子</h2>
              <p className="muted">
                从同一个起点，观察不同规则如何影响这 16 位居民。
              </p>
              {mode !== "mayor" && (
                <div className="permission">切换到「镇长」模式即可修改政策</div>
              )}
              <Control
                label="劳动与分红所得税"
                value={town.policy.incomeTaxRate}
                min={0}
                max={50}
                step={5}
                display={`${town.policy.incomeTaxRate}%`}
                disabled={mode !== "mayor"}
                onChange={(v) => changePolicy({ incomeTaxRate: v })}
                note="工资与分红到个人账户后，所得税划入公共账户。"
              />
              <Control
                label="每日居民补助"
                value={town.policy.ubiCents}
                min={0}
                max={500}
                step={25}
                display={`${money(town.policy.ubiCents)} / 人`}
                disabled={mode !== "mayor"}
                onChange={(v) => changePolicy({ ubiCents: v })}
                note="仅使用公共账户现有资金；不足时按可用预算分配。"
              />
              <Control
                label="AI 生产效率"
                value={town.policy.aiProductivity}
                min={1}
                max={3}
                step={0.25}
                display={`${town.policy.aiProductivity.toFixed(2)}×`}
                disabled={mode !== "mayor"}
                onChange={(v) => changePolicy({ aiProductivity: v })}
                note="简化生产工具加成，不是大模型或智能体调用。"
              />
              <div className="policy-summary">
                <Fact label="今日已发补助" value={money(m.transfersCents)} />
                <Fact
                  label="补助资金覆盖"
                  value={`${m.transferFundingRate.toFixed(0)}%`}
                />
                <Fact
                  label="未满足食物需求"
                  value={`${m.unmetNeedsToday} 人`}
                />
              </div>
              <button
                className="compare"
                onClick={() => {
                  setComparison(
                    comparePolicies(
                      town.seed,
                      [
                        {
                          name: "初始规则",
                          policy: createTown(town.seed).policy,
                        },
                        { name: "当前规则", policy: town.policy },
                      ],
                      30,
                    ),
                  );
                  setMessage("已从相同种子和初始账户独立运行两组 30 天实验");
                }}
              >
                对照实验 · 从相同起点运行 30 天 ↗
              </button>
              {comparison && (
                <div className="comparison">
                  <h3>30 天对照结果</h3>
                  <div className="comparison-grid">
                    {comparison.map((c) => (
                      <div key={c.name}>
                        <strong>{c.name}</strong>
                        <Fact
                          label="生活状态"
                          value={c.final.averageWellbeing.toFixed(1)}
                        />
                        <Fact label="就业" value={`${c.final.employed} 人`} />
                        <Fact
                          label="公共余额"
                          value={money(c.final.treasuryCents)}
                        />
                        <Fact
                          label="缺少食物"
                          value={`${c.final.unmetNeedsToday} 人`}
                        />
                      </div>
                    ))}
                  </div>
                  <p>
                    相同种子与初始条件；仅政策不同。模型结果不证明现实社会政策的优劣。
                  </p>
                </div>
              )}
            </div>
          )}
          {tab === "ledger" && (
            <div className="ledger-content">
              <small>EVERY COIN HAS A STORY</small>
              <h2>每一笔，都有来处</h2>
              <div className="account-summary">
                <Fact label="家庭资金" value={money(m.householdCashCents)} />
                <Fact label="企业资金" value={money(m.firmCashCents)} />
                <Fact label="公共资金" value={money(m.treasuryCents)} />
                <Fact label="系统总资金" value={money(m.totalMoneyCents)} />
              </div>
              <h3>食品企业</h3>
              {town.firms.map((f) => (
                <div className="firm" key={f.id}>
                  <strong>{f.name}</strong>
                  <span>{money(town.accounts[f.accountId].balanceCents)}</span>
                  <p>
                    {f.workerIds.length} 名雇员 · 库存 {f.inventory} 份 · 单价{" "}
                    {money(f.priceCents)}
                  </p>
                </div>
              ))}
              <h3>
                最近交易 <small>完整记录保存在导出存档中</small>
              </h3>
              <div className="transactions">
                {town.ledger
                  .slice(-10)
                  .reverse()
                  .map((t) => (
                    <div key={t.id}>
                      <span>
                        <b>{t.memo}</b>
                        <small>
                          第 {t.day} 天 · {t.kind}
                        </small>
                      </span>
                      <strong>{money(t.amountCents)}</strong>
                    </div>
                  ))}
                {!town.ledger.length && (
                  <p className="muted">还没有交易。前进一天试试。</p>
                )}
              </div>
            </div>
          )}
          <div className="save-panel">
            <div>
              <button onClick={save}>保存</button>
              <button onClick={restore}>读取</button>
              <button onClick={exportSave}>导出 ↓</button>
              <button
                onClick={() => {
                  if (input.current) {
                    input.current.value = "";
                    input.current.click();
                  }
                }}
              >
                导入 ↑
              </button>
              <input
                hidden
                type="file"
                accept=".json,application/json"
                ref={input}
                onChange={(e) => void importSave(e.target.files?.[0])}
              />
            </div>
            <p>无需登录 · 数据留在你的浏览器中</p>
          </div>
        </aside>
      </main>
      <footer role="status">
        <span>✦ {message}</span>
        <button
          onClick={() => {
            if (window.confirm("重新开始会丢弃当前未保存的进度。继续吗？")) {
              importGeneration.current++;
              if (input.current) input.current.value = "";
              setTown(createTown("little-common-01"));
              setRunning(false);
              accumulator.current = 0;
              setComparison(null);
              setMessage("已回到小镇的第一天");
            }
          }}
        >
          重新开始
        </button>
      </footer>
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="玩法与模型假设"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="close" onClick={() => setHelp(false)}>
              关闭 ×
            </button>
            <small>A LITTLE WORLD, OPEN TO EXPERIMENT</small>
            <h2>看见一座小镇怎样生活</h2>
            <p>
              先按「开始生活」。点选居民观察账户、食物和生活状态，再切换镇长调整政策。居民模式可改变当前居民的工作意愿和购买食物。
            </p>
            <h3>这是一份清晰、有限的模型</h3>
            <ul>
              <li>16 位居民、8 个家庭、2 家食品企业，只有一种必需品</li>
              <li>
                每天结算就业、生产、工资、税收、购物与消费；画面帧率不影响规则
              </li>
              <li>
                货币使用整数分，每笔转账借贷平衡；没有银行、信贷、货币增发或外部市场
              </li>
              <li>AI 仅是显式生产率参数；没有逐居民的大模型调用</li>
              <li>生活状态为模型指标；动画与氛围文案不代表居民真实心理</li>
              <li>
                政策对照采用同种子初始条件；不能据此证明现实政策的社会效果
              </li>
            </ul>
            <p className="muted">
              存档保留完整状态和账本。导入前验证版本、类型、账户与库存不变量。
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
function Stat({
  label,
  value,
  suffix,
  trend,
}: {
  label: string;
  value: string;
  suffix?: string;
  trend: string;
}) {
  return (
    <div className="stat">
      <small>{label}</small>
      <strong>
        {value}
        <em>{suffix}</em>
      </strong>
      <p>{trend}</p>
    </div>
  );
}
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function Meter({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="meter">
      <div>
        <span>{label}</span>
        <strong>
          {Math.round(value)} <small>/ 100</small>
        </strong>
      </div>
      <div className="meter-track">
        <i
          style={{
            width: `${Math.max(0, Math.min(100, value))}%`,
            background: color,
          }}
        />
      </div>
    </div>
  );
}
function Control({
  label,
  value,
  min,
  max,
  step,
  display,
  disabled,
  onChange,
  note,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  disabled: boolean;
  onChange: (v: number) => void;
  note: string;
}) {
  return (
    <label className="control">
      <span>
        {label}
        <strong>{display}</strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <small>{note}</small>
    </label>
  );
}
