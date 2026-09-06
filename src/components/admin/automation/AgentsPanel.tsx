"use client";
// ============================================================
// Agents panel — the dynamic Agent Registry.
// Create / edit / activate / run agents without touching code. Tool keys and
// permissions are validated on the server; the form only offers real values.
// ============================================================
import { useMemo, useState } from "react";
import { Bot, Play, ShieldCheck, Wrench, Clock3, ShieldAlert } from "lucide-react";
import { Badge, Button, Modal } from "@/components/ui/primitives";
import { toFa } from "@/lib/utils";
import { useUi } from "@/stores/useApp";
import { getJson, sendJson, type AgentRow, type ToolRow } from "./client";
import { Cell, ErrorNote, Field, JsonBox, LoadingRow, NoData, PanelCard, Row, StatusBadge, TableShell, inputClass, usePanelData } from "./Atoms";

interface RegistryMeta {
  storeMode: string;
  storeReason: string;
  types: string[];
  statuses: string[];
  runtimes: string[];
  handlers: string[];
  permissions: { key: string; label: string; risk: string }[];
  tools: ToolRow[];
  llm: { provider: string; configured: boolean; reason?: string | null };
}

interface AgentFormState {
  key: string;
  name: string;
  description: string;
  type: string;
  status: string;
  runtime: string;
  handler: string;
  systemPrompt: string;
  tools: string[];
  permissions: string[];
  maxRetries: string;
  timeoutMs: string;
  maxCostMicro: string;
  config: string;
}

const EMPTY_FORM: AgentFormState = {
  key: "",
  name: "",
  description: "",
  type: "executor",
  status: "draft",
  runtime: "local",
  handler: "",
  systemPrompt: "",
  tools: [],
  permissions: [],
  maxRetries: "1",
  timeoutMs: "30000",
  maxCostMicro: "0",
  config: "{}",
};

// ------------------------------------------------------------
// Readable renderers for run output — dataState and _agent.guard as badges
// and lists, never raw JSON.
// ------------------------------------------------------------
interface GuardShape {
  removals?: { path?: string; value?: unknown; reason?: string }[];
  warnings?: string[];
  pricesCorrected?: number;
  emptyProductList?: boolean;
}

type DataStateTone = "success" | "gold" | "neutral" | "accent" | "dark";

const DATA_STATE_META: Record<string, { label: string; tone: DataStateTone }> = {
  ok: { label: "دادهٔ کامل", tone: "success" },
  not_enough_data: { label: "دادهٔ ناکافی", tone: "gold" },
  no_data: { label: "بدون داده", tone: "neutral" },
  degraded: { label: "کاهش‌یافته", tone: "accent" },
};

export function DataStateBadge({ dataState }: { dataState?: string | null }) {
  const meta = DATA_STATE_META[String(dataState ?? "")];
  if (!meta) return null;
  return <Badge tone={meta.tone}>dataState: {meta.label}</Badge>;
}

/** Pulls { dataState, _agent.guard } out of an AgentRunResult-shaped object. */
function runFacts(result: Record<string, unknown>) {
  const output = (result.output && typeof result.output === "object" ? result.output : result) as Record<string, unknown>;
  const agentMeta = (output._agent && typeof output._agent === "object" ? output._agent : {}) as Record<string, unknown>;
  const guard = (agentMeta.guard && typeof agentMeta.guard === "object" ? agentMeta.guard : null) as GuardShape | null;
  return {
    output,
    guard,
    dataState: String(output.dataState ?? result.dataState ?? agentMeta.dataState ?? ""),
    attempts: typeof agentMeta.attempts === "number" ? agentMeta.attempts : undefined,
    guardCount: guard?.removals?.length ?? 0,
    guardWarnings: guard?.warnings?.length ?? 0,
  };
}

function formatWhen(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return `${toFa(d.toLocaleDateString("fa-IR"))} ${toFa(d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }))}`;
  } catch {
    return "—";
  }
}

/** Persian description of an agent schedule (daily/weekly/cron). */
function scheduleLabel(schedule?: Record<string, unknown> | null): string {
  if (!schedule || typeof schedule !== "object") return "";
  const kind = String(schedule.kind ?? "");
  const at = String(schedule.at ?? "");
  if (kind === "daily") return `روزانه ساعت ${at || "—"}`;
  if (kind === "weekly") return `هفتگی (${String(schedule.day ?? "")}) ساعت ${at || "—"}`;
  if (kind === "hourly") return `هر ${String(schedule.every ?? "")} ساعت`;
  if (kind === "cron") return `cron: ${String(schedule.cron ?? "")}`;
  return "زمان‌بندی‌شده";
}

function GuardRemovals({ guard }: { guard: GuardShape }) {
  const removals = guard.removals ?? [];
  const warnings = guard.warnings ?? [];
  const corrected = guard.pricesCorrected ?? 0;
  return (
    <div className="space-y-1.5 rounded-lg border border-clay/40 bg-ivory-2 p-2.5">
      {removals.length > 0 && (
        <div>
          <div className="mb-1 flex items-center gap-1 text-2xs font-bold text-terracotta-deep"><ShieldAlert size={12} /> {toFa(removals.length)} مقدار نامعتبر حذف شد</div>
          {removals.slice(0, 8).map((removal, index) => (
            <div key={index} className="flex items-start gap-1.5 border-t border-clay/30 py-1 text-2xs leading-5">
              <code dir="ltr" className="shrink-0 rounded bg-cream px-1.5 font-mono text-2xs text-ink">{removal.path ?? "?"}</code>
              <span className="text-ink-muted">{removal.reason ?? "حذف شد"}</span>
            </div>
          ))}
          {removals.length > 8 && <div className="text-2xs text-ink-muted">… و {toFa(removals.length - 8)} مورد دیگر</div>}
        </div>
      )}
      {corrected > 0 && <Badge tone="gold">{toFa(corrected)} قیمت با کاتالوگ واقعی اصلاح شد</Badge>}
      {guard.emptyProductList && <Badge tone="neutral">فهرست محصولات پس از حذف‌ها خالی ماند</Badge>}
      {warnings.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {warnings.slice(0, 4).map((warning, index) => <Badge key={index} tone="neutral">{warning}</Badge>)}
        </div>
      )}
      {!removals.length && !corrected && !warnings.length && !guard.emptyProductList && <div className="text-2xs text-ink-muted">هیچ مقدار نامعتبری در خروجی نبود ✓</div>}
    </div>
  );
}

function RunSummary({ result }: { result: Record<string, unknown> }) {
  const facts = runFacts(result);
  const status = String(result.status ?? "");
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <DataStateBadge dataState={facts.dataState} />
        <StatusBadge status={status || "unknown"} />
        {facts.attempts ? <Badge>تلاش: {toFa(facts.attempts)}</Badge> : null}
        {typeof result.errorCode === "string" && result.errorCode ? <Badge tone="accent">{String(result.errorCode)}</Badge> : null}
        {typeof result.error === "string" && result.error ? <Badge tone="dark">{String(result.error)}</Badge> : null}
      </div>
      {facts.guard ? <GuardRemovals guard={facts.guard} /> : null}
      <details className="text-2xs text-ink-muted">
        <summary className="cursor-pointer select-none">مشاهدهٔ خروجی خام</summary>
        <div className="mt-1.5"><JsonBox value={result} max={10} /></div>
      </details>
    </div>
  );
}

function formFromAgent(agent: AgentRow): AgentFormState {
  return {
    key: agent.key,
    name: agent.name,
    description: agent.description ?? "",
    type: agent.type,
    status: agent.status,
    runtime: agent.runtime ?? "local",
    handler: agent.handler ?? "",
    systemPrompt: agent.systemPrompt ?? "",
    tools: agent.tools ?? [],
    permissions: agent.permissions ?? [],
    maxRetries: String(agent.maxRetries ?? 1),
    timeoutMs: String(agent.timeoutMs ?? 30000),
    maxCostMicro: "0",
    config: JSON.stringify(agent.config ?? {}, null, 2),
  };
}

export function AgentsPanel() {
  const toast = useUi((s) => s.toast);
  const { data, error, loading, reload } = usePanelData<{ items: AgentRow[]; meta: RegistryMeta }>(() => getJson("/api/automation/agents"), []);

  const [editing, setEditing] = useState<AgentFormState | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<{ agent: AgentRow; input: string; busy: boolean; result: unknown } | null>(null);
  const [details, setDetails] = useState<{ agent: AgentRow; runs: unknown[] } | null>(null);

  const meta = data?.meta;
  const agents = useMemo(() => data?.items ?? [], [data]);

  /** Granting a tool also grants the permission it needs (event handler, not an effect). */
  function toggleTool(toolKey: string, checked: boolean) {
    if (!editing || !meta) return;
    const tools = checked ? [...editing.tools, toolKey] : editing.tools.filter((key) => key !== toolKey);
    let permissions = editing.permissions;
    if (checked) {
      const required = meta.tools.find((tool) => tool.key === toolKey)?.requiredPermission;
      if (required && !permissions.includes(required)) permissions = [...permissions, required];
    }
    setEditing({ ...editing, tools, permissions });
  }

  if (loading) return <LoadingRow />;
  if (error || !data) return <ErrorNote message={error ?? "داده‌ای دریافت نشد"} onRetry={reload} />;

  async function save() {
    if (!editing || !meta) return;
    let config: Record<string, unknown> = {};
    try {
      config = editing.config.trim() ? (JSON.parse(editing.config) as Record<string, unknown>) : {};
    } catch {
      toast("JSON تنظیمات نامعتبر است", "error");
      return;
    }
    const payload = {
      key: editing.key.trim().toLowerCase(),
      name: editing.name.trim(),
      description: editing.description,
      type: editing.type,
      status: editing.status,
      runtime: editing.runtime,
      handler: editing.handler || null,
      systemPrompt: editing.systemPrompt,
      tools: editing.tools,
      permissions: editing.permissions,
      maxRetries: Number(editing.maxRetries) || 0,
      timeoutMs: Number(editing.timeoutMs) || 30000,
      maxCostMicro: Number(editing.maxCostMicro) || 0,
      config,
    };
    setSaving(true);
    try {
      if (isNew) {
        const created = await sendJson<{ agent: AgentRow; warnings: string[] }>("POST", "/api/automation/agents", payload);
        toast(`ایجنت «${created.agent.name}» ساخته شد`);
        created.warnings?.forEach((w) => toast(w, "info"));
      } else {
        const { key, ...patch } = payload;
        void key;
        await sendJson<{ agent: AgentRow }>("PATCH", `/api/automation/agents/${encodeURIComponent(payload.key)}`, patch);
        toast("ایجنت بروزرسانی شد");
      }
      setEditing(null);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "ذخیره ناموفق بود", "error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(agent: AgentRow) {
    const next = agent.status === "active" ? "paused" : "active";
    try {
      await sendJson("PATCH", `/api/automation/agents/${encodeURIComponent(agent.key)}`, { status: next });
      toast(`وضعیت به «${next === "active" ? "فعال" : "متوقف"}» تغییر کرد`);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "تغییر وضعیت ناموفق بود", "error");
    }
  }

  async function remove(agent: AgentRow) {
    try {
      await sendJson("DELETE", `/api/automation/agents/${encodeURIComponent(agent.key)}`);
      toast("ایجنت حذف شد");
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "حذف ناموفق بود", "error");
    }
  }

  async function runAgent() {
    if (!running) return;
    let input: Record<string, unknown> = {};
    try {
      input = running.input.trim() ? (JSON.parse(running.input) as Record<string, unknown>) : {};
    } catch {
      toast("JSON ورودی نامعتبر است", "error");
      return;
    }
    setRunning({ ...running, busy: true, result: null });
    try {
      const result = await sendJson<Record<string, unknown>>("POST", `/api/automation/agents/${encodeURIComponent(running.agent.key)}/run`, { input });
      setRunning({ ...running, busy: false, result });
      toast("اجرا پایان یافت");
      reload();
    } catch (err) {
      setRunning({ ...running, busy: false, result: { error: err instanceof Error ? err.message : "اجرا ناموفق بود" } });
      toast(err instanceof Error ? err.message : "اجرا ناموفق بود", "error");
    }
  }

  async function openDetails(agent: AgentRow) {
    try {
      const detail = await getJson<{ agent: AgentRow; runs: unknown[] }>(`/api/automation/agents/${encodeURIComponent(agent.key)}`);
      setDetails(detail);
    } catch (err) {
      toast(err instanceof Error ? err.message : "خواندن جزئیات ناموفق بود", "error");
    }
  }

  return (
    <div className="space-y-5">
      <PanelCard
        title="رجیستری ایجنت‌ها"
        desc="ایجنت‌ها داده هستند نه کد — ابزار و مجوز هرکدام همین‌جا تعیین می‌شود"
        action={<Button size="sm" onClick={() => { setIsNew(true); setEditing({ ...EMPTY_FORM }); }}><Bot size={16} /> ایجنت جدید</Button>}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2 text-2xs text-ink-muted">
          <Badge tone={data.meta.storeMode === "database" ? "success" : "gold"}>ذخیره‌سازی: {data.meta.storeMode === "database" ? "پایگاه‌داده" : "حافظه فرآیند"}</Badge>
          <Badge tone={data.meta.llm.configured ? "success" : "neutral"}>LLM: {data.meta.llm.configured ? data.meta.llm.provider : data.meta.llm.reason ?? "پیکربندی نشده"}</Badge>
          <span>{data.meta.storeReason}</span>
        </div>

        {agents.length ? (
          <TableShell head={["ایجنت", "نوع", "ابزارها", "مجوزها", "زمان‌بندی و اجرا", "وضعیت", "عملیات"]} minWidth={1040}>
            {agents.map((agent) => (
              <Row key={agent.key}>
                <Cell>
                  <button type="button" onClick={() => openDetails(agent)} className="text-right">
                    <span className="font-medium text-ink hover:text-terracotta-deep">{agent.name}</span>
                  </button>
                  <div dir="ltr" className="text-2xs text-ink-muted">{agent.key}{agent.isBuiltin ? " · builtin" : ""}</div>
                  {agent.description && <div className="mt-1 line-clamp-2 max-w-md text-2xs text-ink-muted">{agent.description}</div>}
                </Cell>
                <Cell className="text-xs">{agent.type}<div className="text-2xs text-ink-muted">{agent.handler ?? "declarative"} · {agent.runtime ?? "local"}</div></Cell>
                <Cell>
                  <div className="flex flex-wrap gap-1">
                    {agent.tools.slice(0, 4).map((t) => <Badge key={t}>{t}</Badge>)}
                    {agent.tools.length > 4 && <Badge>+{toFa(agent.tools.length - 4)}</Badge>}
                    {!agent.tools.length && <span className="text-2xs text-ink-muted">بدون ابزار</span>}
                  </div>
                </Cell>
                <Cell><div className="flex flex-wrap gap-1">{agent.permissions.slice(0, 3).map((p) => <Badge key={p}>{p}</Badge>)}{agent.permissions.length > 3 && <Badge>+{toFa(agent.permissions.length - 3)}</Badge>}</div></Cell>
                <Cell>
                  <div className="space-y-1 text-2xs">
                    {agent.schedule && Object.keys(agent.schedule).length ? (
                      <div className="flex items-center gap-1.5 font-medium text-ink">
                        <Clock3 size={12} className="shrink-0 text-terracotta-deep" />
                        <span>{scheduleLabel(agent.schedule as Record<string, unknown> | null)}</span>
                      </div>
                    ) : (
                      <div className="text-ink-muted">اجرا: دستی</div>
                    )}
                    <div className="text-ink-muted">آخرین اجرا: {formatWhen(agent.lastRunAt ?? null)}</div>
                    {agent.nextRunAt ? <div className="text-ink-muted">اجرای بعدی: {formatWhen(agent.nextRunAt)}</div> : null}
                  </div>
                </Cell>
                <Cell><StatusBadge status={agent.status} /></Cell>
                <Cell>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => setRunning({ agent, input: "{}", busy: false, result: null })}><Play size={14} /> اجرا</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setIsNew(false); setEditing(formFromAgent(agent)); }}>ویرایش</Button>
                    <Button size="sm" variant="ghost" onClick={() => toggleStatus(agent)}>{agent.status === "active" ? "توقف" : "فعال‌سازی"}</Button>
                    {!agent.isBuiltin && <Button size="sm" variant="danger" onClick={() => remove(agent)}>حذف</Button>}
                  </div>
                </Cell>
              </Row>
            ))}
          </TableShell>
        ) : (
          <NoData title="هیچ ایجنتی ثبت نشده است" desc="با «ایجنت جدید» اولین ایجنت را بساز؛ ابزارها و مجوزها از رجیستری واقعی انتخاب می‌شوند." />
        )}
      </PanelCard>

      {/* ---------- create / edit ---------- */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={isNew ? "ایجنت جدید" : `ویرایش ایجنت ${editing?.name ?? ""}`}
        description="ابزارها و مجوزها روی سرور اعتبارسنجی می‌شوند؛ مقدار نامعتبر نادیده گرفته می‌شود."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>انصراف</Button>
            <Button onClick={save} disabled={saving || !editing?.key || !editing?.name}>{saving ? "در حال ذخیره…" : "ذخیره"}</Button>
          </>
        }
      >
        {editing && meta && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="کلید (لاتین، یکتا)"><input dir="ltr" className={inputClass} value={editing.key} disabled={!isNew} onChange={(e) => setEditing({ ...editing, key: e.target.value })} placeholder="price-watcher" /></Field>
            <Field label="نام"><input className={inputClass} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="پایش قیمت" /></Field>
            <Field label="توضیح"><input className={inputClass} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
            <Field label="نوع">
              <select className={inputClass} value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })}>
                {meta.types.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="وضعیت">
              <select className={inputClass} value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                {meta.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="runtime" hint="بیرونی‌ها فقط در صورت پیکربندی کلید استفاده می‌شوند؛ در غیر این صورت اجرای محلی">
              <select className={inputClass} value={editing.runtime} onChange={(e) => setEditing({ ...editing, runtime: e.target.value })}>
                {meta.runtimes.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="handler" hint="خالی = declarative (LLM + ابزارهای اعطاشده)">
              <select className={inputClass} value={editing.handler} onChange={(e) => setEditing({ ...editing, handler: e.target.value })}>
                <option value="">— declarative —</option>
                {meta.handlers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </Field>
            <Field label="حداکثر تلاش مجدد"><input dir="ltr" className={inputClass} value={editing.maxRetries} onChange={(e) => setEditing({ ...editing, maxRetries: e.target.value.replace(/[^\d]/g, "") })} /></Field>
            <Field label="تایم‌اوت (ms)"><input dir="ltr" className={inputClass} value={editing.timeoutMs} onChange={(e) => setEditing({ ...editing, timeoutMs: e.target.value.replace(/[^\d]/g, "") })} /></Field>
            <Field label="سقف هزینه هر اجرا (میکرو، ۰ = بدون سقف)"><input dir="ltr" className={inputClass} value={editing.maxCostMicro} onChange={(e) => setEditing({ ...editing, maxCostMicro: e.target.value.replace(/[^\d]/g, "") })} /></Field>

            <div className="sm:col-span-2">
              <Field label="system prompt" hint="فقط روی سرور نگهداری می‌شود">
                <textarea dir="rtl" rows={3} className={inputClass} value={editing.systemPrompt} onChange={(e) => setEditing({ ...editing, systemPrompt: e.target.value })} />
              </Field>
            </div>

            <div className="sm:col-span-2">
              <div className="mb-1 flex items-center gap-2 text-xs font-medium text-ink-muted"><Wrench size={14} /> ابزارها ({toFa(editing.tools.length)})</div>
              <div className="grid max-h-52 gap-1.5 overflow-y-auto rounded-lg border border-clay/50 p-2 sm:grid-cols-2">
                {meta.tools.map((tool) => (
                  <label key={tool.key} className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-ivory-2">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={editing.tools.includes(tool.key)}
                      onChange={(e) => toggleTool(tool.key, e.target.checked)}
                    />
                    <span>
                      <span dir="ltr" className="font-medium text-ink">{tool.key}</span>
                      <span className="block text-2xs text-ink-muted">{tool.name}{tool.requiresApproval ? " · نیازمند تأیید انسانی" : ""}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="sm:col-span-2">
              <div className="mb-1 flex items-center gap-2 text-xs font-medium text-ink-muted"><ShieldCheck size={14} /> مجوزها ({toFa(editing.permissions.length)})</div>
              <div className="grid max-h-44 gap-1.5 overflow-y-auto rounded-lg border border-clay/50 p-2 sm:grid-cols-2">
                {meta.permissions.map((permission) => (
                  <label key={permission.key} className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-ivory-2">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={editing.permissions.includes(permission.key)}
                      onChange={(e) => setEditing({ ...editing, permissions: e.target.checked ? [...editing.permissions, permission.key] : editing.permissions.filter((p) => p !== permission.key) })}
                    />
                    <span>
                      <span dir="ltr" className="font-medium text-ink">{permission.key}</span>
                      <span className="block text-2xs text-ink-muted">{permission.label} · ریسک {permission.risk}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="sm:col-span-2">
              <Field label="config (JSON)" hint="مقادیر پیش‌فرض هندلر مثل limit / threshold / defaultToolPlan">
                <textarea dir="ltr" rows={5} className={`${inputClass} font-mono text-[12px]`} value={editing.config} onChange={(e) => setEditing({ ...editing, config: e.target.value })} />
              </Field>
            </div>
          </div>
        )}
      </Modal>

      {/* ---------- run ---------- */}
      <Modal
        open={Boolean(running)}
        onClose={() => setRunning(null)}
        title={`اجرای ایجنت ${running?.agent.name ?? ""}`}
        description="ورودی JSON است. خروجی فقط محصولات/داده‌های واقعی کاتالوگ را نشان می‌دهد."
        footer={<><Button variant="ghost" onClick={() => setRunning(null)}>بستن</Button><Button onClick={runAgent} disabled={running?.busy}><Play size={15} />{running?.busy ? "در حال اجرا…" : "اجرا"}</Button></>}
      >
        {running && (
          <div className="space-y-3">
            <Field label="input (JSON)">
              <textarea dir="ltr" rows={6} className={`${inputClass} font-mono text-[12px]`} value={running.input} onChange={(e) => setRunning({ ...running, input: e.target.value })} />
            </Field>
            {running.result ? (
              <div>
                <div className="mb-1 text-xs font-medium text-ink-muted">خروجی</div>
                <RunSummary result={running.result as Record<string, unknown>} />
              </div>
            ) : (
              <p className="text-xs text-ink-muted">هنوز اجرایی انجام نشده است.</p>
            )}
          </div>
        )}
      </Modal>

      {/* ---------- details ---------- */}
      <Modal open={Boolean(details)} onClose={() => setDetails(null)} title={`جزئیات ${details?.agent.name ?? ""}`} description="آخرین اجراهای ثبت‌شده این ایجنت">
        {details && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge>handler: {details.agent.handler ?? "declarative"}</Badge>
              <Badge>runtime: {details.agent.runtime ?? "local"}</Badge>
              <Badge>retry: {toFa(details.agent.maxRetries ?? 0)}</Badge>
              <Badge>timeout: {toFa(details.agent.timeoutMs ?? 0)}ms</Badge>
              <StatusBadge status={details.agent.status} />
            </div>
            <JsonBox value={{ tools: details.agent.tools, permissions: details.agent.permissions, config: details.agent.config }} max={14} />
            <div className="text-xs font-medium text-ink-muted">آخرین اجراها</div>
            {details.runs.length ? (
              <div className="space-y-2">
                {details.runs.slice(0, 10).map((run) => {
                  const record = run as Record<string, unknown>;
                  return (
                    <div key={String(record.id ?? JSON.stringify(record))} className="rounded-lg border border-clay/40 bg-ivory-2 p-2.5">
                      <div className="flex flex-wrap items-center gap-1.5 text-2xs">
                        <StatusBadge status={String(record.status ?? "")} />
                        {typeof record.startedAt === "string" && <span className="text-ink-muted">{formatWhen(record.startedAt)}</span>}
                        {typeof record.durationMs === "number" && <span className="text-ink-muted">زمان: {toFa(record.durationMs)}ms</span>}
                        {typeof record.errorCode === "string" && record.errorCode ? <Badge tone="accent">{String(record.errorCode)}</Badge> : null}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {Array.isArray(record.toolsUsed) ? (record.toolsUsed as string[]).slice(0, 5).map((tool) => <Badge key={tool}>{tool}</Badge>) : null}
                      </div>
                      {typeof record.error === "string" && record.error ? <div className="mt-1 text-2xs leading-5 text-ink-muted">{record.error}</div> : null}
                    </div>
                  );
                })}
                {details.runs.length > 10 && <div className="text-2xs text-ink-muted">… و {toFa(details.runs.length - 10)} اجرای دیگر</div>}
              </div>
            ) : (
              <NoData title="هنوز اجرایی ثبت نشده" desc="با دکمهٔ «اجرا» اولین اجرای این ایجنت را ببین." />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
