"use client";
import { Badge, LogoBlock } from "@/components/ui/primitives";
import { toFa } from "@/lib/utils";

const USERS = [
  { name: "نگار مرادی", email: "negar@mail.com", role: "customer", status: "active", tone: "success" as const },
  { name: "آرش رستمی", email: "arash@mail.com", role: "vendor", status: "active", tone: "success" as const },
  { name: "نور مبلمان", email: "info@noor.com", role: "vendor", status: "pending", tone: "gold" as const },
  { name: "سارا کاظمی", email: "sara@mail.com", role: "customer", status: "active", tone: "success" as const },
  { name: "محمد تقوی", email: "mohammad@mail.com", role: "customer", status: "blocked", tone: "dark" as const },
];
const ROLE_LABEL: Record<string, string> = { customer: "مشتری", vendor: "فروشنده", admin: "مدیر" };
const STATUS_LABEL: Record<string, string> = { active: "فعال", pending: "در انتظار", blocked: "مسدود" };

export default function AdminUsersPage() {
  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl font-black text-ink">مدیریت کاربران</h1>
      <div className="overflow-hidden card-surface">
        <table className="w-full min-w-[560px] text-sm">
          <thead><tr className="border-b border-clay/40 bg-ivory-2 text-right text-xs text-ink-muted">
            <th className="p-3 font-medium">کاربر</th><th className="p-3 font-medium">نقش</th><th className="p-3 font-medium">وضعیت</th><th className="p-3 font-medium"></th>
          </tr></thead>
          <tbody>
            {USERS.map((u, i) => (
              <tr key={i} className="border-b border-clay/30 hover:bg-ivory-2/50">
                <td className="p-3"><div className="flex items-center gap-2"><LogoBlock char={u.name[0]} color="#6b6358" size={36} /><div><div className="font-medium text-ink">{u.name}</div><div className="text-xs text-ink-muted">{u.email}</div></div></div></td>
                <td className="p-3 text-ink">{ROLE_LABEL[u.role]}</td>
                <td className="p-3"><Badge tone={u.tone}>{STATUS_LABEL[u.status]}</Badge></td>
                <td className="p-3 text-left"><button className="rounded-lg border border-clay/60 px-3 py-1 text-xs text-ink hover:bg-ivory-2">مدیریت</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-muted">نمایش {toFa(USERS.length)} کاربر از مجموع ۱۸٬۴۰۰ (داده‌ی نمونه)</p>
    </div>
  );
}
