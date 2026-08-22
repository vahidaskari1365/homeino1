"use client";
import { Sparkles, TrendingUp } from "lucide-react";
import { toFa } from "@/lib/utils";

export default function AdminAiPage() {
  const rows = [
    { op: "طراحی از متن", count: 4200, credits: 21000 },
    { op: "بازطراحی اتاق", count: 3100, credits: 15500 },
    { op: "ویرایش عکس", count: 2800, credits: 8400 },
    { op: "کانسپت کامل", count: 900, credits: 7200 },
    { op: "پیشنهاد محصول", count: 1400, credits: 4200 },
  ];
  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl font-black text-ink">مصرف هوش مصنوعی</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <div className="card-surface p-5"><Sparkles size={20} className="text-gold" /><div className="mt-2 font-display text-2xl font-black text-ink">{toFa("۱۲٬۴۰۰")}</div><div className="text-xs text-ink-muted">عملیات امروز</div></div>
        <div className="card-surface p-5"><TrendingUp size={20} className="text-success" /><div className="mt-2 font-display text-2xl font-black text-ink">{toFa("۵۶٬۳۰۰")}</div><div className="text-xs text-ink-muted">اعتبار مصرفی ماه</div></div>
        <div className="card-surface p-5"><Sparkles size={20} className="text-terracotta-deep" /><div className="mt-2 font-display text-2xl font-black text-ink">{toFa("۹۸٪")}</div><div className="text-xs text-ink-muted">نرخ موفقیت</div></div>
      </div>
      <div className="card-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-clay/40 bg-ivory-2 text-right text-xs text-ink-muted"><th className="p-3 font-medium">عملیات</th><th className="p-3 font-medium">تعداد</th><th className="p-3 font-medium">اعتبار مصرفی</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.op} className="border-b border-clay/30 hover:bg-ivory-2/50"><td className="p-3 text-ink">{r.op}</td><td className="p-3 text-ink">{toFa(r.count.toLocaleString("fa-IR"))}</td><td className="p-3 text-ink">{toFa(r.credits.toLocaleString("fa-IR"))}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
