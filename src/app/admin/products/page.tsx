"use client";
import { Badge } from "@/components/ui/primitives";
import { products } from "@/data/products";
import { toFa, formatPrice } from "@/lib/utils";

export default function AdminProductsPage() {
  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl font-black text-ink">مدیریت محصولات</h1>
      <div className="overflow-hidden card-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-clay/40 bg-ivory-2 text-right text-xs text-ink-muted">
              <th className="p-3 font-medium">محصول</th><th className="p-3 font-medium">فروشنده</th><th className="p-3 font-medium">قیمت</th><th className="p-3 font-medium">وضعیت</th>
            </tr></thead>
            <tbody>
              {products.slice(0, 10).map((p) => (
                <tr key={p.id} className="border-b border-clay/30 hover:bg-ivory-2/50">
                  <td className="p-3"><div className="flex items-center gap-2"><img src={p.images[0]} alt="" className="h-9 w-9 rounded-lg object-cover" /><span className="line-clamp-1 font-medium text-ink">{p.name}</span></div></td>
                  <td className="p-3 text-ink">{p.brand}</td>
                  <td className="p-3 whitespace-nowrap text-ink">{toFa(formatPrice(p.price))} ت</td>
                  <td className="p-3">{p.inStock ? <Badge tone="success">تأیید شده</Badge> : <Badge tone="gold">در انتظار بررسی</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
