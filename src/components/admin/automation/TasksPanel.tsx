"use client";
// ============================================================
// Tasks panel — the Task Queue: pending admin/vendor work produced by agents.
// Retry re-runs the bound agent; cancel is logged with the actor.
// ============================================================
import { useState } from "react";
import { ListChecks, Plus, RotateCcw, XCircle } from "lucide-react";
import { Badge, Button, Modal } from "@/components/ui/primitives";
import { toFa } from "@/lib/utils";
import { useUi } from "@/stores/useApp";
import { getJson, sendJson, type TaskRow } from "./client";
import { Cell, ErrorNote, Field, JsonBox, LoadingRow, NoData, PanelCard, Row, StatusBadge, TableShell, inputClass, usePanelData } from "./Atoms";

interface TasksPayload {
  items: TaskRow[];
  count: number;
  summary: { total: number; byStatus: Record<string, number> };
  dataState: string;
}

const STATUS_FILTERS = ["pending", "running", "waiting_approval", "completed", "failed", "cancelled"];

export function TasksPanel() {
  const toast = useUi((s) => s.toast);
  const [status, setStatus] = useState<string>("pending");
  const { data, error, loading, reload } = usePanelData<TasksPayload>(
    () => getJson<TasksPayload>(`/api/automation/tasks?limit=100${status ? `&status=${status}` : ""}`),
    [status],
  );

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", type: "manual", priority: "0", assigneeRole: "admin", payload: "{}" });
  const [inspecting, setInspecting] = useState<{ task: TaskRow; logs: unknown[] } | null>(null);

  if (loading) return <LoadingRow />;
  if (error || !data) return <ErrorNote message={error ?? "داده‌ای دریافت نشد"} onRetry={reload} />;

  async function act(task: TaskRow, action: "retry" | "run" | "cancel") {
    try {
      const result = await sendJson<Record<string, unknown>>("PATCH", `/api/automation/tasks/${encodeURIComponent(task.id)}`, { action });
      toast(action === "cancel" ? "وظیفه لغو شد" : `نتیجه: ${String(result.status ?? "انجام شد")}`, result.ok === false ? "error" : "success");
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "عملیات ناموفق بود", "error");
    }
  }

  async function inspect(task: TaskRow) {
    try {
      const detail = await getJson<{ task: TaskRow; logs: unknown[] }>(`/api/automation/tasks/${encodeURIComponent(task.id)}`);
      setInspecting(detail);
    } catch (err) {
      toast(err instanceof Error ? err.message : "خواندن جزئیات ناموفق بود", "error");
    }
  }

  async function create() {
    let payload: Record<string, unknown> = {};
    try {
      payload = form.payload.trim() ? (JSON.parse(form.payload) as Record<string, unknown>) : {};
    } catch {
      toast("JSON payload نامعتبر است", "error");
      return;
    }
    try {
      await sendJson("POST", "/api/automation/tasks", {
        title: form.title.trim(),
        type: form.type,
        priority: Number(form.priority) || 0,
        assigneeRole: form.assigneeRole,
        payload,
      });
      toast("وظیفه ایجاد شد");
      setCreating(false);
      setForm({ title: "", type: "manual", priority: "0", assigneeRole: "admin", payload: "{}" });
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "ایجاد وظیفه ناموفق بود", "error");
    }
  }

  return (
    <div className="space-y-5">
      <PanelCard
        title="صف وظایف"
        desc="وظایف تولیدشده توسط ایجنت‌ها و ورک‌فلوها — با تلاش مجدد و لغو قابل کنترل"
        action={<Button size="sm" onClick={() => setCreating(true)}><Plus size={16} /> وظیفه جدید</Button>}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant={status === "" ? "primary" : "outline"} onClick={() => setStatus("")}>همه ({toFa(data.summary.total)})</Button>
          {STATUS_FILTERS.map((item) => (
            <Button key={item} size="sm" variant={status === item ? "primary" : "outline"} onClick={() => setStatus(item)}>
              {item} ({toFa(data.summary.byStatus[item] ?? 0)})
            </Button>
          ))}
        </div>

        {data.items.length ? (
          <TableShell head={["وظیفه", "نوع", "ایجنت", "تلاش", "وضعیت", "عملیات"]} minWidth={860}>
            {data.items.map((task) => (
              <Row key={task.id}>
                <Cell>
                  <button type="button" onClick={() => inspect(task)} className="text-right">
                    <span className="font-medium text-ink hover:text-terracotta-deep">{task.title}</span>
                  </button>
                  <div className="mt-1 text-[11px] text-ink-muted">
                    اولویت {toFa(task.priority)} · مسئول: {task.assigneeRole || "—"}
                    {task.dueAt ? ` · سررسید: ${toFa(new Date(task.dueAt).toLocaleString("fa-IR"))}` : ""}
                  </div>
                  {task.error && <div className="mt-1 text-[11px] text-danger">{task.error}</div>}
                </Cell>
                <Cell className="text-xs">{task.type}</Cell>
                <Cell className="text-[11px]" ><span dir="ltr">{task.agentKey ?? "—"}</span></Cell>
                <Cell className="text-xs">{toFa(task.attempt)} / {toFa(task.maxAttempts)}</Cell>
                <Cell><StatusBadge status={task.status} /></Cell>
                <Cell>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => act(task, "run")}><ListChecks size={14} /> اجرا</Button>
                    <Button size="sm" variant="ghost" onClick={() => act(task, "retry")}><RotateCcw size={14} /> تلاش مجدد</Button>
                    {task.status !== "completed" && task.status !== "cancelled" && (
                      <Button size="sm" variant="danger" onClick={() => act(task, "cancel")}><XCircle size={14} /> لغو</Button>
                    )}
                  </div>
                </Cell>
              </Row>
            ))}
          </TableShell>
        ) : (
          <NoData title="وظیفه‌ای در این وضعیت نیست" desc="صف خالی است — هیچ داده‌ای ساخته نمی‌شود." />
        )}
      </PanelCard>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="وظیفه جدید"
        description="وظایف دستی هم مانند وظایف ایجنت‌ها لاگ و تلاش مجدد دارند."
        footer={<><Button variant="ghost" onClick={() => setCreating(false)}>انصراف</Button><Button onClick={create} disabled={!form.title.trim()}>ایجاد</Button></>}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="عنوان"><input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field></div>
          <Field label="نوع"><input dir="ltr" className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} /></Field>
          <Field label="اولویت"><input dir="ltr" className={inputClass} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value.replace(/[^\d]/g, "") })} /></Field>
          <Field label="نقش مسئول">
            <select className={inputClass} value={form.assigneeRole} onChange={(e) => setForm({ ...form, assigneeRole: e.target.value })}>
              {["admin", "vendor", "support"].map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-2"><Field label="payload (JSON)"><textarea dir="ltr" rows={4} className={`${inputClass} font-mono text-[12px]`} value={form.payload} onChange={(e) => setForm({ ...form, payload: e.target.value })} /></Field></div>
        </div>
      </Modal>

      <Modal open={Boolean(inspecting)} onClose={() => setInspecting(null)} title={inspecting?.task.title ?? ""} description="لاگ کامل وظیفه">
        {inspecting && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <StatusBadge status={inspecting.task.status} />
              <Badge>تلاش {toFa(inspecting.task.attempt)} از {toFa(inspecting.task.maxAttempts)}</Badge>
              {inspecting.task.agentKey && <Badge><span dir="ltr">{inspecting.task.agentKey}</span></Badge>}
            </div>
            <div><div className="mb-1 text-xs font-medium text-ink-muted">payload</div><JsonBox value={inspecting.task.payload} max={10} /></div>
            <div><div className="mb-1 text-xs font-medium text-ink-muted">result</div><JsonBox value={inspecting.task.result ?? {}} max={10} /></div>
            <div><div className="mb-1 text-xs font-medium text-ink-muted">لاگ‌ها</div><JsonBox value={inspecting.logs} max={16} /></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
