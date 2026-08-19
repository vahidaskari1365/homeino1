"use client";
import { Badge, LogoBlock } from "@/components/ui/primitives";
import { stores } from "@/data/stores";
import { toFa } from "@/lib/utils";

export default function AdminVendorsPage() {
  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl font-black text-ink">مدیریت فروشندگان</h1>
      <div className="card-surface overflow-hidden">
        <div className="table-shell">
        <table className="w-full min-w-[560px] text-sm">
          <thead><tr className="border-b border-clay/40 bg-ivory-2 text-right text-xs text-ink-muted"><th className="p-3 font-medium">فروشگاه</th><th className="p-3 font-medium">محصول</th><th className="p-3 font-medium">امتیاز</th><th className="p-3 font-medium">وضعیت</th></tr></thead>
          <tbody>
            {stores.map((s) => (
              <tr key={s.id} className="border-b border-clay/30 hover:bg-ivory-2/50">
                <td className="p-3"><div className="flex items-center gap-2"><LogoBlock char={s.logo} color={s.logoColor} size={32} /><span className="font-medium text-ink">{s.name}</span></div></td>
                <td className="p-3 text-ink">{toFa(s.productCount)}</td>
                <td className="p-3 text-ink">{toFa(s.rating.toFixed(1))}</td>
                <td className="p-3">{s.verified ? <Badge tone="success">تأیید شده</Badge> : <Badge tone="gold">در انتظار</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
