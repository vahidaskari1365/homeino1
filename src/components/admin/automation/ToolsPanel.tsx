"use client";
// ============================================================
// Tools panel — the Tool Registry (read-only by design).
// Tools are code-backed capabilities; admins grant them to agents and see
// exactly which permission each one needs and whether it is destructive.
// ============================================================
import { Wrench } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { toFa } from "@/lib/utils";
import { getJson, type ToolRow } from "./client";
import { Cell, ErrorNote, JsonBox, LoadingRow, NoData, PanelCard, Row, TableShell, usePanelData } from "./Atoms";

interface ToolsPayload {
  items: ToolRow[];
  permissions: { key: string; label: string; risk: string; requiresApproval: boolean }[];
  count: number;
}

const CATEGORY_LABEL: Record<string, string> = {
  catalog: "کاتالوگ",
  customer: "مشتری",
  recommendation: "پیشنهاد",
  automation: "اتوماسیون",
  commerce: "تجارت",
  ai: "هوش مصنوعی",
  browser: "مرورگر",
  memory: "حافظه",
  notification: "اعلان",
  system: "سیستم",
};

export function ToolsPanel() {
  const { data, error, loading, reload } = usePanelData<ToolsPayload>(() => getJson("/api/automation/tools"), []);

  if (loading) return <LoadingRow />;
  if (error || !data) return <ErrorNote message={error ?? "داده‌ای دریافت نشد"} onRetry={reload} />;

  const grouped = data.items.reduce<Record<string, ToolRow[]>>((acc, tool) => {
    const bucket = tool.category || "system";
    acc[bucket] = acc[bucket] ?? [];
    acc[bucket].push(tool);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <PanelCard title="رجیستری ابزارها" desc={`${toFa(data.count)} ابزار قابل اعطا به ایجنت‌ها — هرکدام با مجوز مشخص`}>
        {data.items.length ? (
          <TableShell head={["ابزار", "دسته", "مجوز لازم", "ریسک", "ورودی"]} minWidth={820}>
            {Object.entries(grouped).map(([category, tools]) =>
              tools.map((tool) => (
                <Row key={tool.key}>
                  <Cell>
                    <div className="flex items-center gap-2">
                      <Wrench size={15} className="text-ink-muted" />
                      <span>
                        <span className="font-medium text-ink">{tool.name}</span>
                        <span dir="ltr" className="ml-2 text-[11px] text-ink-muted">{tool.key}</span>
                      </span>
                    </div>
                    <div className="mt-1 max-w-md text-[11px] text-ink-muted">{tool.description}</div>
                  </Cell>
                  <Cell className="text-xs">{CATEGORY_LABEL[category] ?? category}</Cell>
                  <Cell>
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge tone={tool.requiresApproval ? "accent" : "neutral"}><span dir="ltr">{tool.requiredPermission}</span></Badge>
                      {tool.requiresApproval && <Badge tone="gold">تأیید انسانی</Badge>}
                      {tool.isDestructive && <Badge tone="dark">مخرب</Badge>}
                      {!tool.isActive && <Badge>غیرفعال</Badge>}
                    </div>
                  </Cell>
                  <Cell className="text-xs">{data.permissions.find((p) => p.key === tool.requiredPermission)?.risk ?? "—"}</Cell>
                  <Cell><JsonBox value={tool.inputSchema} max={6} /></Cell>
                </Row>
              )),
            )}
          </TableShell>
        ) : (
          <NoData title="ابزاری ثبت نشده است" desc="رجیستری ابزارها خالی است — بدون ابزار، ایجنت‌ها فقط می‌توانند متن تولید کنند." />
        )}
      </PanelCard>

      <PanelCard title="جدول مجوزها" desc="سطح دسترسی ایجنت‌ها — مجوزهای پرخطر همیشه نیازمند تأیید انسانی هستند">
        <div className="flex flex-wrap gap-2">
          {data.permissions.map((permission) => (
            <Badge key={permission.key} tone={permission.requiresApproval ? "accent" : "neutral"}>
              <span dir="ltr">{permission.key}</span> · {permission.label} · {permission.risk}
            </Badge>
          ))}
        </div>
      </PanelCard>
    </div>
  );
}
