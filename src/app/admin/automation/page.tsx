"use client";
// ============================================================
// /admin/automation — Agentic control room.
//
// One new admin page (same visual language as the rest of the panel):
// overview · agents · tools · workflows · tasks · approvals · logs · budgets
// ============================================================
import { useState } from "react";
import { Bot, Coins, FileSearch, LayoutDashboard, ListChecks, ShieldCheck, Workflow, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { OverviewPanel } from "@/components/admin/automation/OverviewPanel";
import { AgentsPanel } from "@/components/admin/automation/AgentsPanel";
import { ToolsPanel } from "@/components/admin/automation/ToolsPanel";
import { WorkflowsPanel } from "@/components/admin/automation/WorkflowsPanel";
import { TasksPanel } from "@/components/admin/automation/TasksPanel";
import { ApprovalsPanel } from "@/components/admin/automation/ApprovalsPanel";
import { LogsPanel } from "@/components/admin/automation/LogsPanel";
import { BudgetsPanel } from "@/components/admin/automation/BudgetsPanel";

type TabId = "overview" | "agents" | "tools" | "workflows" | "tasks" | "approvals" | "logs" | "budgets";

const TABS: { id: TabId; label: string; icon: typeof Bot }[] = [
  { id: "overview", label: "نمای کلی", icon: LayoutDashboard },
  { id: "agents", label: "ایجنت‌ها", icon: Bot },
  { id: "tools", label: "ابزارها", icon: Wrench },
  { id: "workflows", label: "ورک‌فلوها", icon: Workflow },
  { id: "tasks", label: "صف وظایف", icon: ListChecks },
  { id: "approvals", label: "تأیید انسانی", icon: ShieldCheck },
  { id: "logs", label: "لاگ اجرا", icon: FileSearch },
  { id: "budgets", label: "سقف هزینه", icon: Coins },
];

export default function AdminAutomationPage() {
  const [tab, setTab] = useState<TabId>("overview");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-black text-ink">اتوماسیون و ایجنت‌ها</h1>
        <p className="mt-1 text-sm text-ink-muted">
          رجیستری ایجنت‌ها، سازنده ورک‌فلو، صف وظایف، تأیید انسانی، لاگ اجرا و کنترل هزینه — همه روی داده واقعی.
        </p>
      </div>

      <div className="card-surface flex flex-wrap gap-2 p-3">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
              tab === item.id ? "bg-ink text-cream" : "text-ink-muted hover:bg-ivory-2 hover:text-ink",
            )}
          >
            <item.icon size={16} /> {item.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewPanel />}
      {tab === "agents" && <AgentsPanel />}
      {tab === "tools" && <ToolsPanel />}
      {tab === "workflows" && <WorkflowsPanel />}
      {tab === "tasks" && <TasksPanel />}
      {tab === "approvals" && <ApprovalsPanel />}
      {tab === "logs" && <LogsPanel />}
      {tab === "budgets" && <BudgetsPanel />}
    </div>
  );
}
