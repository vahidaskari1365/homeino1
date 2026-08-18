"use client";
import Link from "next/link";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { Button, Badge, Rating } from "@/components/ui/primitives";
import { products } from "@/data/products";
import { toFa, formatPrice } from "@/lib/utils";
import { useState } from "react";

export default function VendorProductsPage() {
  const [q, setQ] = useState("");
  const list = products.filter((p) => (q ? p.name.includes(q) : true)).slice(0, 8);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-xl font-black text-ink">محصولات ({toFa(list.length)})</h1>
        <Link href="/vendor/products/new"><Button><Plus size={16} /> افزودن محصول</Button></Link>
      </div>
      <div className="flex items-center rounded-xl border border-clay/60 bg-cream px-3 focus-within:border-ink">
        <Search size={17} className="text-ink-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی محصول…" className="flex-1 bg-transparent px-2 py-2.5 text-sm outline-none" />
      </div>
      <div className="overflow-hidden card-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-clay/40 bg-ivory-2 text-right text-xs text-ink-muted">
              <th className="p-3 font-medium">محصول</th><th className="p-3 font-medium">قیمت</th><th className="p-3 font-medium">موجودی</th><th className="p-3 font-medium">امتیاز</th><th className="p-3 font-medium">وضعیت</th><th className="p-3 font-medium"></th>
            </tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="border-b border-clay/30 hover:bg-ivory-2/50">
                  <td className="p-3"><div className="flex items-center gap-2"><img src={p.images[0]} alt="" className="h-10 w-10 rounded-lg object-cover" /><span className="line-clamp-1 font-medium text-ink">{p.name}</span></div></td>
                  <td className="p-3 whitespace-nowrap text-ink">{toFa(formatPrice(p.price))} ت</td>
                  <td className="p-3 text-ink">{toFa(p.stockCount)}</td>
                  <td className="p-3"><Rating value={p.rating} /></td>
                  <td className="p-3">{p.inStock ? <Badge tone="success">موجود</Badge> : <Badge tone="dark">ناموجود</Badge>}</td>
                  <td className="p-3"><div className="flex justify-end gap-1"><Link href="/vendor/products/new" aria-label="ویرایش محصول" className="grid h-9 w-9 place-items-center rounded-lg transition hover:bg-ivory-2"><Pencil size={15} /></Link><button aria-label="حذف محصول" className="grid h-9 w-9 place-items-center rounded-lg text-danger transition hover:bg-danger/10"><Trash2 size={15} /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
