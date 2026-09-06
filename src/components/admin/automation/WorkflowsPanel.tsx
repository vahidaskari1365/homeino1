"use client";
// ============================================================
// Workflows panel — the visual builder + runner.
//
// Nodes: Trigger · Condition · AI Agent · DB Query · DB Update ·
//        Recommendation · Notification · Delay · Schedule · Human Approval ·
//        HTTP Request · Browser Task · End
// Graphs are saved to the database, validated server-side, runnable manually,
// schedulable, and every run keeps per-node step logs.
// ============================================================
import { useMemo, useState } from "react";
import { GitBranch, Play, Plus, ShieldCheck, Trash2, Workflow } from "lucide-react";
import { Badge, Button, Modal } from "@/components/ui/primitives";
import { toFa } from "@/lib/utils";
import { useUi } from "@/stores/useApp";
import { getJson, sendJson, type StepRow, type WorkflowEdgeRow, type WorkflowNodeRow, type WorkflowRow } from "./client";
import { Cell, ErrorNote, Field, JsonBox, LoadingRow, NoData, PanelCard, Row, StatusBadge, TableShell, inputClass, usePanelData } from "./Atoms";

interface BuilderMeta {
  nodeTypes: { type: string; label: string }[];
  triggerKinds: string[];
  statuses: string[];
  agents: { key: string; name: string; status: string }[];
}

interface DraftWorkflow {
  key: string;
  name: string;
  description: string;
  status: string;
  runtime: string;
  triggerKind: string;
  eventTypes: string;
  windowMinutes: string;
  condition: string;
  scheduleKind: string;
  scheduleAt: string;
  scheduleEvery: string;
  scheduleCron: string;
  nodes: WorkflowNodeRow[];
  edges: WorkflowEdgeRow[];
}

const NODE_LABEL_FA: Record<string, string> = {
  trigger: "تریگر",
  condition: "شرط",
  agent: "ایجنت هومینو استودیو",
  db_query: "کوئری پایگاه‌داده",
  db_update: "بروزرسانی پایگاه‌داده",
  recommendation: "پیشنهاد محصول",
  notification: "اعلان",
  delay: "تأخیر",
  schedule: "زمان‌بندی",
  human_approval: "تأیید انسانی",
  http_request: "درخواست HTTP",
  browser_task: "وظیفه مرورگر",
  end: "پایان",
};

const EMPTY_DRAFT: DraftWorkflow = {
  key: "",
  name: "",
  description: "",
  status: "draft",
  runtime: "local",
  triggerKind: "manual",
  eventTypes: "",
  windowMinutes: "1440",
  condition: "",
  scheduleKind: "manual",
  scheduleAt: "09:00",
  scheduleEvery: "60",
  scheduleCron: "",
  nodes: [
    { key: "trigger", type: "trigger", label: "آغاز", config: {} },
    { key: "end", type: "end", label: "پایان", config: {} },
  ],
  edges: [{ from: "trigger", to: "end", label: null }],
};

function draftFromWorkflow(workflow: WorkflowRow): DraftWorkflow {
  const trigger = (workflow.trigger ?? {}) as Record<string, unknown>;
  const schedule = (workflow.schedule ?? {}) as Record<string, unknown>;
  return {
    key: workflow.key,
    name: workflow.name,
    description: workflow.description ?? "",
    status: workflow.status,
    runtime: workflow.runtime ?? "local",
    triggerKind: workflow.triggerKind,
    eventTypes: Array.isArray(trigger.eventTypes) ? (trigger.eventTypes as string[]).join(", ") : "",
    windowMinutes: String(trigger.windowMinutes ?? 1440),
    condition: typeof trigger.condition === "string" ? trigger.condition : "",
    scheduleKind: String(schedule.kind ?? "manual"),
    scheduleAt: String(schedule.at ?? "09:00"),
    scheduleEvery: String(schedule.everyMinutes ?? 60),
    scheduleCron: String(schedule.cron ?? ""),
    nodes: workflow.nodes.map((node) => ({ ...node, config: node.config ?? {} })),
    edges: workflow.edges.map((edge) => ({ ...edge })),
  };
}

function payloadFromDraft(draft: DraftWorkflow) {
  const eventTypes = draft.eventTypes.split(/[,\u060C]/).map((v) => v.trim()).filter(Boolean);
  const trigger: Record<string, unknown> = {};
  if (eventTypes.length) trigger.eventTypes = eventTypes;
  const windowMinutes = Number(draft.windowMinutes);
  if (Number.isFinite(windowMinutes) && windowMinutes > 0) trigger.windowMinutes = Math.round(windowMinutes);
  if (draft.condition.trim()) trigger.condition = draft.condition.trim();

  const schedule: Record<string, unknown> = { kind: draft.scheduleKind };
  if (draft.scheduleKind === "daily" || draft.scheduleKind === "weekly") schedule.at = draft.scheduleAt;
  if (draft.scheduleKind === "interval") schedule.everyMinutes = Number(draft.scheduleEvery) || 60;
  if (draft.scheduleKind === "cron" && draft.scheduleCron.trim()) schedule.cron = draft.scheduleCron.trim();

  return {
    key: draft.key.trim().toLowerCase(),
    name: draft.name.trim(),
    description: draft.description,
    status: draft.status,
    runtime: draft.runtime,
    triggerKind: draft.triggerKind,
    trigger: Object.keys(trigger).length ? trigger : undefined,
    schedule: draft.triggerKind === "schedule" ? schedule : undefined,
    nodes: draft.nodes.map((node) => ({ ...node, config: node.config ?? {} })),
    edges: draft.edges,
  };
}

interface RunResult {
  ok: boolean;
  status: string;
  runId?: string | null;
  output?: Record<string, unknown>;
  steps?: StepRow[];
  error?: string | null;
  usage?: { tokensIn: number; tokensOut: number; costMicro: number; durationMs: number };
}

export function WorkflowsPanel() {
  const toast = useUi((s) => s.toast);
  const { data, error, loading, reload } = usePanelData<{ items: WorkflowRow[]; meta: BuilderMeta }>(() => getJson("/api/automation/workflows"), []);

  const [draft, setDraft] = useState<DraftWorkflow | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validation, setValidation] = useState<{ ok: boolean; errors: string[]; warnings: string[] } | null>(null);
  const [runState, setRunState] = useState<{ workflow: WorkflowRow; busy: boolean; input: string; result: RunResult | null } | null>(null);
  const [nodeConfigs, setNodeConfigs] = useState<Record<string, string>>({});

  const meta = data?.meta;
  const workflows = useMemo(() => data?.items ?? [], [data]);
  const nodeKeys = (draft?.nodes ?? []).map((n) => n.key);

  if (loading) return <LoadingRow />;
  if (error || !data) return <ErrorNote message={error ?? "داده‌ای دریافت نشد"} onRetry={reload} />;

  function configText(node: WorkflowNodeRow): string {
    return nodeConfigs[node.key] ?? JSON.stringify(node.config ?? {}, null, 2);
  }

  function setNodeConfig(key: string, text: string) {
    setNodeConfigs((prev) => ({ ...prev, [key]: text }));
  }

  function applyNodeConfigs(current: DraftWorkflow): DraftWorkflow {
    return {
      ...current,
      nodes: current.nodes.map((node) => {
        const text = nodeConfigs[node.key];
        if (text === undefined) return node;
        try {
          return { ...node, config: JSON.parse(text) as Record<string, unknown> };
        } catch {
          return node;
        }
      }),
    };
  }

  async function validate(showToast = true) {
    if (!draft) return null;
    const current = applyNodeConfigs(draft);
    setDraft(current);
    try {
      const result = await sendJson<{ ok: boolean; errors: string[]; warnings: string[] }>(
        "POST",
        `/api/automation/workflows/${encodeURIComponent(current.key || "draft")}/validate`,
        { nodes: current.nodes, edges: current.edges, name: current.name, triggerKind: current.triggerKind, trigger: { eventTypes: current.eventTypes.split(",").map((v) => v.trim()).filter(Boolean) } },
      );
      setValidation(result);
      if (showToast) toast(result.ok ? "اعتبارسنجی موفق بود" : "اعتبارسنجی خطا دارد", result.ok ? "success" : "error");
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "اعتبارسنجی ناموفق بود";
      setValidation({ ok: false, errors: [message], warnings: [] });
      toast(message, "error");
      return null;
    }
  }

  async function save() {
    if (!draft) return;
    const current = applyNodeConfigs(draft);
    const payload = payloadFromDraft(current);
    if (!payload.key || !payload.name) {
      toast("کلید و نام ورک‌فلو الزامی است", "error");
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        await sendJson("POST", "/api/automation/workflows", payload);
        toast("ورک‌فلو ساخته شد");
      } else {
        const { key, ...patch } = payload;
        void key;
        await sendJson("PATCH", `/api/automation/workflows/${encodeURIComponent(payload.key)}`, patch);
        toast("ورک‌فلو بروزرسانی شد");
      }
      setDraft(null);
      setNodeConfigs({});
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "ذخیره ناموفق بود", "error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(workflow: WorkflowRow) {
    const next = workflow.status === "active" ? "paused" : "active";
    try {
      await sendJson("PATCH", `/api/automation/workflows/${encodeURIComponent(workflow.key)}`, { status: next });
      toast(next === "active" ? "ورک‌فلو فعال شد" : "ورک‌فلو متوقف شد");
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "تغییر وضعیت ناموفق بود", "error");
    }
  }

  async function remove(workflow: WorkflowRow) {
    try {
      await sendJson("DELETE", `/api/automation/workflows/${encodeURIComponent(workflow.key)}`);
      toast("ورک‌فلو حذف شد");
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "حذف ناموفق بود", "error");
    }
  }

  async function runNow() {
    if (!runState) return;
    let input: Record<string, unknown> = {};
    try {
      input = runState.input.trim() ? (JSON.parse(runState.input) as Record<string, unknown>) : {};
    } catch {
      toast("JSON ورودی نامعتبر است", "error");
      return;
    }
    setRunState({ ...runState, busy: true, result: null });
    try {
      const payload = await sendJson<{ result: RunResult }>("POST", `/api/automation/workflows/${encodeURIComponent(runState.workflow.key)}/run`, {
        input,
        triggerPayload: input,
      });
      setRunState({ ...runState, busy: false, result: payload.result });
      toast(payload.result.ok ? "ورک‌فلو با موفقیت اجرا شد" : `اجرا با وضعیت ${payload.result.status} پایان یافت`, payload.result.ok ? "success" : "info");
      reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : "اجرا ناموفق بود";
      setRunState({ ...runState, busy: false, result: { ok: false, status: "failed", error: message } });
      toast(message, "error");
    }
  }

  return (
    <div className="space-y-5">
      <PanelCard
        title="ورک‌فلوها"
        desc="گراف‌های ذخیره‌شده: قابل اجرا، زمان‌بندی، اعتبارسنجی و لاگ‌گیری گام‌به‌گام"
        action={<Button size="sm" onClick={() => { setIsNew(true); setValidation(null); setNodeConfigs({}); setDraft({ ...EMPTY_DRAFT, nodes: EMPTY_DRAFT.nodes.map((n) => ({ ...n })), edges: [...EMPTY_DRAFT.edges] }); }}><Plus size={16} /> ورک‌فلوی جدید</Button>}
      >
        {workflows.length ? (
          <TableShell head={["ورک‌فلو", "تریگر", "گره‌ها", "وضعیت", "آخرین اجرا", "عملیات"]} minWidth={900}>
            {workflows.map((workflow) => (
              <Row key={workflow.key}>
                <Cell>
                  <div className="font-medium text-ink">{workflow.name}</div>
                  <div dir="ltr" className="text-2xs text-ink-muted">{workflow.key}{workflow.isBuiltin ? " · builtin" : ""} · v{toFa(workflow.version ?? 1)}</div>
                  {workflow.description && <div className="mt-1 line-clamp-2 max-w-md text-2xs text-ink-muted">{workflow.description}</div>}
                </Cell>
                <Cell className="text-xs">
                  <Badge tone={workflow.triggerKind === "event" ? "accent" : workflow.triggerKind === "schedule" ? "gold" : "neutral"}>{workflow.triggerKind}</Badge>
                  {Array.isArray((workflow.trigger as { eventTypes?: string[] })?.eventTypes) && (
                    <div className="mt-1 text-2xs text-ink-muted" dir="ltr">{((workflow.trigger as { eventTypes?: string[] }).eventTypes ?? []).join(", ")}</div>
                  )}
                  {workflow.nextRunAt && <div className="mt-1 text-2xs text-ink-muted">اجرای بعدی: {toFa(new Date(workflow.nextRunAt).toLocaleString("fa-IR"))}</div>}
                </Cell>
                <Cell className="text-xs">
                  <div className="flex items-center gap-1 text-ink-muted"><GitBranch size={14} /> {toFa(workflow.nodes.length)} گره · {toFa(workflow.edges.length)} یال</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {workflow.nodes.slice(0, 5).map((node) => <Badge key={node.key}>{NODE_LABEL_FA[node.type] ?? node.type}</Badge>)}
                    {workflow.nodes.length > 5 && <Badge>+{toFa(workflow.nodes.length - 5)}</Badge>}
                  </div>
                </Cell>
                <Cell><StatusBadge status={workflow.status} /></Cell>
                <Cell className="text-2xs text-ink-muted">{workflow.lastRunAt ? toFa(new Date(workflow.lastRunAt).toLocaleString("fa-IR")) : "اجرا نشده"}</Cell>
                <Cell>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => setRunState({ workflow, busy: false, input: "{}", result: null })}><Play size={14} /> اجرا</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setIsNew(false); setValidation(null); setNodeConfigs({}); setDraft(draftFromWorkflow(workflow)); }}>ویرایش</Button>
                    <Button size="sm" variant="ghost" onClick={() => toggleStatus(workflow)}>{workflow.status === "active" ? "توقف" : "فعال‌سازی"}</Button>
                    {!workflow.isBuiltin && <Button size="sm" variant="danger" onClick={() => remove(workflow)}><Trash2 size={14} /></Button>}
                  </div>
                </Cell>
              </Row>
            ))}
          </TableShell>
        ) : (
          <NoData title="ورک‌فلویی ثبت نشده است" desc="اولین ورک‌فلو را با گره تریگر، یک ایجنت و گره پایان بساز." />
        )}
      </PanelCard>

      {/* ---------------- builder ---------------- */}
      <Modal
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        title={isNew ? "ورک‌فلوی جدید" : `ویرایش ورک‌فلو ${draft?.name ?? ""}`}
        description="گره‌ها را به ترتیب اجرا بچین و یال‌ها را مشخص کن؛ شرط‌ها با برچسب true/false مسیر را انتخاب می‌کنند."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDraft(null)}>انصراف</Button>
            <Button variant="outline" onClick={() => validate(true)}><ShieldCheck size={15} /> اعتبارسنجی</Button>
            <Button onClick={save} disabled={saving || !draft?.key || !draft?.name}>{saving ? "در حال ذخیره…" : "ذخیره"}</Button>
          </>
        }
      >
        {draft && meta && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="کلید (لاتین، یکتا)"><input dir="ltr" className={inputClass} value={draft.key} disabled={!isNew} onChange={(e) => setDraft({ ...draft, key: e.target.value })} placeholder="views-to-recommendations" /></Field>
              <Field label="نام"><input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="از بازدید تا پیشنهاد" /></Field>
              <Field label="توضیح"><input className={inputClass} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field>
              <Field label="وضعیت">
                <select className={inputClass} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                  {meta.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="نوع تریگر">
                <select className={inputClass} value={draft.triggerKind} onChange={(e) => setDraft({ ...draft, triggerKind: e.target.value })}>
                  {meta.triggerKinds.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="runtime" hint="بیرونی‌ها فقط با کلید پیکربندی‌شده؛ در غیر این صورت محلی">
                <select className={inputClass} value={draft.runtime} onChange={(e) => setDraft({ ...draft, runtime: e.target.value })}>
                  {["local", "dify", "langflow"].map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              {draft.triggerKind === "event" && (
                <>
                  <Field label="رویدادها (با کاما جدا کن)" hint="مثلاً product_view, wishlist_add"><input dir="ltr" className={inputClass} value={draft.eventTypes} onChange={(e) => setDraft({ ...draft, eventTypes: e.target.value })} /></Field>
                  <Field label="پنجره زمانی (دقیقه)"><input dir="ltr" className={inputClass} value={draft.windowMinutes} onChange={(e) => setDraft({ ...draft, windowMinutes: e.target.value.replace(/[^\d]/g, "") })} /></Field>
                </>
              )}
              {draft.triggerKind === "schedule" && (
                <>
                  <Field label="نوع زمان‌بندی">
                    <select className={inputClass} value={draft.scheduleKind} onChange={(e) => setDraft({ ...draft, scheduleKind: e.target.value })}>
                      {["manual", "interval", "daily", "weekly", "cron"].map((k) => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </Field>
                  {draft.scheduleKind === "interval" && <Field label="هر چند دقیقه"><input dir="ltr" className={inputClass} value={draft.scheduleEvery} onChange={(e) => setDraft({ ...draft, scheduleEvery: e.target.value.replace(/[^\d]/g, "") })} /></Field>}
                  {(draft.scheduleKind === "daily" || draft.scheduleKind === "weekly") && <Field label="ساعت (UTC)"><input dir="ltr" className={inputClass} value={draft.scheduleAt} onChange={(e) => setDraft({ ...draft, scheduleAt: e.target.value })} placeholder="09:00" /></Field>}
                  {draft.scheduleKind === "cron" && <Field label="عبارت cron"><input dir="ltr" className={inputClass} value={draft.scheduleCron} onChange={(e) => setDraft({ ...draft, scheduleCron: e.target.value })} placeholder="0 9 * * *" /></Field>}
                </>
              )}
            </div>

            {/* nodes */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-medium text-ink-muted"><Workflow size={14} /> گره‌ها ({toFa(draft.nodes.length)})</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDraft({ ...draft, nodes: [...draft.nodes, { key: `node_${draft.nodes.length + 1}`, type: "agent", label: "", config: {} }] })}
                >
                  <Plus size={14} /> گره
                </Button>
              </div>
              <div className="space-y-3">
                {draft.nodes.map((node, index) => (
                  <div key={`${node.key}-${index}`} className="rounded-xl border border-clay/50 p-3">
                    <div className="grid gap-3 sm:grid-cols-4">
                      <Field label="کلید گره"><input dir="ltr" className={inputClass} value={node.key} onChange={(e) => {
                        const key = e.target.value;
                        setDraft({ ...draft, nodes: draft.nodes.map((n, i) => (i === index ? { ...n, key } : n)), edges: draft.edges.map((edge) => ({ ...edge, from: edge.from === node.key ? key : edge.from, to: edge.to === node.key ? key : edge.to })) });
                      }} /></Field>
                      <Field label="نوع">
                        <select className={inputClass} value={node.type} onChange={(e) => setDraft({ ...draft, nodes: draft.nodes.map((n, i) => (i === index ? { ...n, type: e.target.value } : n)) })}>
                          {meta.nodeTypes.map((t) => <option key={t.type} value={t.type}>{t.label} ({t.type})</option>)}
                        </select>
                      </Field>
                      <Field label="برچسب"><input className={inputClass} value={node.label ?? ""} onChange={(e) => setDraft({ ...draft, nodes: draft.nodes.map((n, i) => (i === index ? { ...n, label: e.target.value } : n)) })} /></Field>
                      <Field label="ایجنت" hint="برای گره‌های agent / recommendation">
                        <select className={inputClass} value={node.agentKey ?? ""} onChange={(e) => setDraft({ ...draft, nodes: draft.nodes.map((n, i) => (i === index ? { ...n, agentKey: e.target.value || undefined } : n)) })}>
                          <option value="">—</option>
                          {meta.agents.map((agent) => <option key={agent.key} value={agent.key}>{agent.name} ({agent.status})</option>)}
                        </select>
                      </Field>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                      <Field label="config (JSON)">
                        <textarea dir="ltr" rows={3} className={`${inputClass} font-mono text-2xs`} value={configText(node)} onChange={(e) => setNodeConfig(node.key, e.target.value)} />
                      </Field>
                      <div className="flex items-end">
                        <Button size="sm" variant="danger" onClick={() => setDraft({ ...draft, nodes: draft.nodes.filter((_, i) => i !== index), edges: draft.edges.filter((edge) => edge.from !== node.key && edge.to !== node.key) })}><Trash2 size={14} /></Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* edges */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-medium text-ink-muted"><GitBranch size={14} /> یال‌ها ({toFa(draft.edges.length)})</span>
                <Button size="sm" variant="outline" onClick={() => setDraft({ ...draft, edges: [...draft.edges, { from: nodeKeys[0] ?? "", to: nodeKeys[1] ?? nodeKeys[0] ?? "", label: null }] })}><Plus size={14} /> یال</Button>
              </div>
              <div className="space-y-2">
                {draft.edges.map((edge, index) => (
                  <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                    <select className={inputClass} value={edge.from} onChange={(e) => setDraft({ ...draft, edges: draft.edges.map((x, i) => (i === index ? { ...x, from: e.target.value } : x)) })}>
                      <option value="">— از —</option>
                      {nodeKeys.map((key) => <option key={key} value={key}>{key}</option>)}
                    </select>
                    <select className={inputClass} value={edge.to} onChange={(e) => setDraft({ ...draft, edges: draft.edges.map((x, i) => (i === index ? { ...x, to: e.target.value } : x)) })}>
                      <option value="">— به —</option>
                      {nodeKeys.map((key) => <option key={key} value={key}>{key}</option>)}
                    </select>
                    <input className={inputClass} placeholder="برچسب شرط (true/false)" value={edge.label ?? ""} onChange={(e) => setDraft({ ...draft, edges: draft.edges.map((x, i) => (i === index ? { ...x, label: e.target.value || null } : x)) })} />
                    <Button size="sm" variant="danger" onClick={() => setDraft({ ...draft, edges: draft.edges.filter((_, i) => i !== index) })}><Trash2 size={14} /></Button>
                  </div>
                ))}
                {!draft.edges.length && <p className="text-xs text-ink-muted">هیچ یالی وجود ندارد — فقط گره اول اجرا می‌شود.</p>}
              </div>
            </div>

            {validation && (
              <div className={`rounded-xl border p-3 text-xs ${validation.ok ? "border-sage/40 bg-sage/8" : "border-danger/30 bg-danger/6"}`}>
                <div className="mb-1 font-medium text-ink">{validation.ok ? "اعتبارسنجی موفق" : "اعتبارسنجی ناموفق"}</div>
                {validation.errors.map((item) => <div key={item} className="text-danger">• {item}</div>)}
                {validation.warnings.map((item) => <div key={item} className="text-ink-muted">• {item}</div>)}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ---------------- run ---------------- */}
      <Modal
        open={Boolean(runState)}
        onClose={() => setRunState(null)}
        title={`اجرای ورک‌فلو ${runState?.workflow.name ?? ""}`}
        description="اجرای دستی با تریگر manual؛ خروجی و لاگ هر گره نمایش داده می‌شود."
        footer={<><Button variant="ghost" onClick={() => setRunState(null)}>بستن</Button><Button onClick={runNow} disabled={runState?.busy}><Play size={15} />{runState?.busy ? "در حال اجرا…" : "اجرا"}</Button></>}
      >
        {runState && (
          <div className="space-y-3">
            <Field label="input / triggerPayload (JSON)">
              <textarea dir="ltr" rows={4} className={`${inputClass} font-mono text-[12px]`} value={runState.input} onChange={(e) => setRunState({ ...runState, input: e.target.value })} />
            </Field>
            {runState.result && (
              <>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <StatusBadge status={runState.result.status} />
                  {runState.result.runId && <span dir="ltr" className="text-ink-muted">{runState.result.runId}</span>}
                  {runState.result.usage && (
                    <Badge>توکن: {toFa(runState.result.usage.tokensIn + runState.result.usage.tokensOut)} · هزینه: {toFa(runState.result.usage.costMicro)} · زمان: {toFa(runState.result.usage.durationMs)}ms</Badge>
                  )}
                </div>
                {runState.result.error && <ErrorNote message={runState.result.error} />}
                {runState.result.steps?.length ? (
                  <TableShell head={["گره", "وضعیت", "زمان", "توکن", "خطا"]} minWidth={520}>
                    {runState.result.steps.map((step, index) => (
                      <Row key={`${step.nodeKey}-${index}`}>
                        <Cell className="text-xs"><span className="font-medium">{step.label ?? step.nodeKey}</span><div className="text-2xs text-ink-muted">{NODE_LABEL_FA[step.nodeType] ?? step.nodeType}{step.agentKey ? ` · ${step.agentKey}` : ""}</div></Cell>
                        <Cell><StatusBadge status={step.status} /></Cell>
                        <Cell className="text-2xs text-ink-muted">{toFa(step.durationMs ?? 0)}ms</Cell>
                        <Cell className="text-2xs text-ink-muted">{toFa(step.tokensIn + step.tokensOut)}</Cell>
                        <Cell className="text-2xs text-danger">{step.error ?? "—"}</Cell>
                      </Row>
                    ))}
                  </TableShell>
                ) : (
                  <p className="text-xs text-ink-muted">گامی ثبت نشده است.</p>
                )}
                <div>
                  <div className="mb-1 text-xs font-medium text-ink-muted">خروجی</div>
                  <JsonBox value={runState.result.output ?? {}} max={16} />
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
