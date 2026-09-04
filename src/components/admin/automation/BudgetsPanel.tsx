"use client";
// ============================================================
// Budgets panel — cost control per scope (global / agent / workflow / user).
// 0 means "not set" so a fresh install keeps working; a limit that is hit
// blocks the run BEFORE any token is spent.
// ============================================================
import { useState } from "react";
import { Coins } from "lucide-react";
import { Badge, Button } from "@/components/ui/primitives";
import { toFa } from "@/lib/utils";
import { useUi } from "@/stores/useApp";
import { getJson, sendJson } from "./client";
import { Cell, ErrorNote, Field, LoadingRow, NoData, PanelCard, Row, TableShell, inputClass, usePanelData } from "./Atoms";

interface BudgetRow {
  id: string;
  scope: string;
  scopeKey?: string | null;
  dailyLimitMicro: number;
  monthlyLimitMicro: number;
  perRunLimitMicro: number;
  maxRunsPerDay: number;
  isActive: boolean;
}

interface BudgetsPayload {
  items: BudgetRow[];
  count: number;
  status: { allowed: boolean; usage: { todayMicro: number; monthMicro: number; runsToday: number }; dataState: string };
}

const SCOPES = ["global", "agent", "workflow", "user"];

export function BudgetsPanel() {
  const toast = useUi((s) => s.toast);
  const { data, error, loading, reload } = usePanelData<BudgetsPayload>(() => getJson<BudgetsPayload>("/api/automation/budgets"), []);
  const [form, setForm] = useState({ scope: "global", scopeKey: "", dailyLimitMicro: "0", monthlyLimitMicro: "0", perRunLimitMicro: "0", maxRunsPerDay: "0", isActive: true });
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingRow />;
  if (error || !data) return <ErrorNote message={error ?? "داده‌ای دریافت نشد"} onRetry={reload} />;

  async function save() {
    setBusy(true);
    try {
      await sendJson("PUT", "/api/automation/budgets", {
        scope: form.scope,
        scopeKey: form.scope === "global" ? null : form.scopeKey.trim() || null,
        dailyLimitMicro: Number(form.dailyLimitMicro) || 0,
        monthlyLimitMicro: Number(form.monthlyLimitMicro) || 0,
        perRunLimitMicro: Number(form.perRunLimitMicro) || 0,
        maxRunsPerDay: Number(form.maxRunsPerDay) || 0,
        isActive: form.isActive,
      });
      toast("سقف هزینه ذخیره شد");
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "ذخیره ناموفق بود", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PanelCard title="سقف هزینه" desc="هزینه‌ها با واحد میکرو (۱/۱٬۰۰۰٬۰۰۰) و به‌صورت عدد صحیح ثبت می‌شوند" action={<Coins size={18} className="text-ink-muted" />}>
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <Badge tone={data.status.allowed ? "success" : "dark"}>{data.status.allowed ? "اجرا مجاز است" : "اجرا به دلیل سقف هزینه مسدود است"}</Badge>
          <Badge>امروز: {toFa(data.status.usage.todayMicro.toLocaleString("fa-IR"))} میکرو</Badge>
          <Badge>این ماه: {toFa(data.status.usage.monthMicro.toLocaleString("fa-IR"))} میکرو</Badge>
          <Badge>اجراهای امروز: {toFa(data.status.usage.runsToday)}</Badge>
        </div>

        {data.items.length ? (
          <TableShell head={["محدوده", "کلید", "روزانه", "ماهانه", "هر اجرا", "حداکثر اجرا/روز", "وضعیت"]} minWidth={820}>
            {data.items.map((row) => (
              <Row key={row.id}>
                <Cell className="text-xs">{row.scope}</Cell>
                <Cell className="text-[11px]"><span dir="ltr">{row.scopeKey ?? "—"}</span></Cell>
                <Cell className="text-[11px]">{row.dailyLimitMicro ? toFa(row.dailyLimitMicro.toLocaleString("fa-IR")) : "بدون سقف"}</Cell>
                <Cell className="text-[11px]">{row.monthlyLimitMicro ? toFa(row.monthlyLimitMicro.toLocaleString("fa-IR")) : "بدون سقف"}</Cell>
                <Cell className="text-[11px]">{row.perRunLimitMicro ? toFa(row.perRunLimitMicro.toLocaleString("fa-IR")) : "بدون سقف"}</Cell>
                <Cell className="text-[11px]">{row.maxRunsPerDay ? toFa(row.maxRunsPerDay) : "بدون سقف"}</Cell>
                <Cell>{row.isActive ? <Badge tone="success">فعال</Badge> : <Badge>غیرفعال</Badge>}</Cell>
              </Row>
            ))}
          </TableShell>
        ) : (
          <NoData title="سقفی تعریف نشده است" desc="بدون سقف، اجراها محدود نمی‌شوند — برای کنترل هزینه حداقل یک سقف global تعریف کن." />
        )}
      </PanelCard>

      <PanelCard title="تعریف / بروزرسانی سقف" desc="مقدار ۰ یعنی بدون سقف">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="محدوده">
            <select className={inputClass} value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}>
              {SCOPES.map((scope) => <option key={scope} value={scope}>{scope}</option>)}
            </select>
          </Field>
          {form.scope !== "global" && (
            <Field label="کلید محدوده" hint="key ایجنت / ورک‌فلو یا شناسه کاربر">
              <input dir="ltr" className={inputClass} value={form.scopeKey} onChange={(e) => setForm({ ...form, scopeKey: e.target.value })} />
            </Field>
          )}
          <Field label="سقف روزانه (میکرو)"><input dir="ltr" className={inputClass} value={form.dailyLimitMicro} onChange={(e) => setForm({ ...form, dailyLimitMicro: e.target.value.replace(/[^\d]/g, "") })} /></Field>
          <Field label="سقف ماهانه (میکرو)"><input dir="ltr" className={inputClass} value={form.monthlyLimitMicro} onChange={(e) => setForm({ ...form, monthlyLimitMicro: e.target.value.replace(/[^\d]/g, "") })} /></Field>
          <Field label="سقف هر اجرا (میکرو)"><input dir="ltr" className={inputClass} value={form.perRunLimitMicro} onChange={(e) => setForm({ ...form, perRunLimitMicro: e.target.value.replace(/[^\d]/g, "") })} /></Field>
          <Field label="حداکثر اجرا در روز"><input dir="ltr" className={inputClass} value={form.maxRunsPerDay} onChange={(e) => setForm({ ...form, maxRunsPerDay: e.target.value.replace(/[^\d]/g, "") })} /></Field>
          <Field label="فعال">
            <select className={inputClass} value={form.isActive ? "true" : "false"} onChange={(e) => setForm({ ...form, isActive: e.target.value === "true" })}>
              <option value="true">بله</option>
              <option value="false">خیر</option>
            </select>
          </Field>
        </div>
        <div className="mt-4"><Button onClick={save} disabled={busy || (form.scope !== "global" && !form.scopeKey.trim())}>{busy ? "در حال ذخیره…" : "ذخیره سقف"}</Button></div>
      </PanelCard>
    </div>
  );
}
