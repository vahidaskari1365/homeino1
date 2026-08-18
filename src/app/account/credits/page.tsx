"use client";
import { Sparkles, Check, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { Button, Badge } from "@/components/ui/primitives";
import { useCredits, useUi } from "@/stores/useApp";
import { CREDIT_DISPLAY } from "@/services/credits/ledger";
import { AI_MODES } from "@/services/ai";
import { toFa, cn } from "@/lib/utils";

export default function CreditsPage() {
  const { balance, history, purchase } = useCredits();
  const { toast } = useUi();

  return (
    <div className="space-y-6">
      {/* balance hero */}
      <div className="relative overflow-hidden rounded-[var(--radius-xl)] bg-gradient-to-bl from-ink to-ink-soft p-7 text-cream">
        <div className="absolute inset-0 grain opacity-30" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-cream/60"><Sparkles size={16} className="text-gold" /> موجودی اعتبار</div>
            <div className="font-display text-5xl font-black">{toFa(balance)}</div>
            <div className="mt-1 text-sm text-cream/60">هر طراحی هوش مصنوعی از این اعتبار کم می‌شود</div>
          </div>
          <div className="rounded-2xl bg-white/10 p-4 text-center">
            <Zap size={22} className="mx-auto text-gold" />
            <div className="mt-1 text-xs text-cream/70">طراحی‌های این ماه</div>
            <div className="font-display text-xl font-bold">{toFa(history.filter((h) => h.amount < 0).length)}</div>
          </div>
        </div>
      </div>

      {/* cost table */}
      <div className="card-surface p-6">
        <h3 className="mb-4 font-display font-bold text-ink">هزینه هر عملیات</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {AI_MODES.map((m) => {
            const enough = balance >= m.cost;
            return (
              <div key={m.id} className={cn("rounded-xl border p-3", enough ? "border-clay/40" : "border-danger/40 bg-danger/5")}>
                <div className="text-sm font-medium text-ink">{m.title}</div>
                <div className="mt-1 flex items-center gap-1 text-xs text-ink-muted"><Sparkles size={12} className="text-gold" /> {toFa(m.cost)} اعتبار</div>
                {!enough && <div className="mt-1 text-[11px] text-danger">اعتبار ناکافی</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* buy credits */}
      <div className="card-surface p-6">
        <h3 className="mb-4 font-display font-bold text-ink">خرید اعتبار</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {CREDIT_DISPLAY.buyPackages.map((pk) => (
            <div key={pk.id} className={cn("relative rounded-2xl border p-5 text-center transition hover:-translate-y-1", pk.popular ? "border-terracotta bg-terracotta/5 shadow-[var(--shadow-soft)]" : "border-clay/50")}>
              {pk.popular && <span className="absolute -top-2.5 right-1/2 translate-x-1/2 rounded-full bg-terracotta px-3 py-0.5 text-[10px] font-bold text-white">محبوب‌ترین</span>}
              <Sparkles size={24} className="mx-auto text-gold" />
              <div className="mt-2 font-display text-2xl font-black text-ink">{toFa(pk.credits)}</div>
              <div className="text-xs text-ink-muted">اعتبار</div>
              <div className="mt-3 font-bold text-ink">{toFa(pk.price.toLocaleString("fa-IR"))} <span className="text-xs text-ink-muted">تومان</span></div>
              <Button className="mt-3 w-full" variant={pk.popular ? "accent" : "ghost"} onClick={async () => { const res = await purchase({ packageId: pk.id, credits: pk.credits, price: pk.price }); toast(res.success ? `${toFa(pk.credits)} اعتبار اضافه شد` : "خطا در پرداخت", res.success ? "success" : "error"); }}>خرید</Button>
            </div>
          ))}
        </div>
      </div>

      {/* subscriptions */}
      <div className="card-surface p-6">
        <h3 className="mb-4 font-display font-bold text-ink">اشتراک ماهانه</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {CREDIT_DISPLAY.subscriptions.map((sub, i) => (
            <div key={sub.id} className={cn("rounded-2xl border p-5", i === 1 ? "border-ink" : "border-clay/50")}>
              <div className="flex items-center justify-between"><span className="font-display font-bold text-ink">{sub.name}</span>{i === 1 && <Badge tone="dark">پیشنهادی</Badge>}</div>
              <div className="mt-2 font-display text-2xl font-black text-ink">{toFa(sub.credits)} <span className="text-xs font-normal text-ink-muted">اعتبار/ماه</span></div>
              <div className="mt-1 text-sm text-ink-muted">{sub.price ? `${toFa(sub.price.toLocaleString("fa-IR"))} تومان/ماه` : "رایگان"}</div>
              <ul className="mt-3 space-y-1.5">
                {sub.perks.map((perk) => <li key={perk} className="flex items-center gap-1.5 text-xs text-ink-muted"><Check size={13} className="text-sage" /> {perk}</li>)}
              </ul>
              <Button variant={i === 1 ? "primary" : "ghost"} className="mt-4 w-full" onClick={() => toast("پرداخت اشتراک به‌زودی فعال می‌شود", "info")}>انتخاب</Button>
            </div>
          ))}
        </div>
      </div>

      {/* history */}
      <div className="card-surface p-6">
        <h3 className="mb-4 font-display font-bold text-ink">تاریخچه اعتبار</h3>
        <div className="divide-y divide-clay/40">
          {history.map((t) => (
            <div key={t.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <span className={cn("grid h-9 w-9 place-items-center rounded-full", t.amount > 0 ? "bg-sage/15 text-success" : "bg-danger/10 text-danger")}>{t.amount > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}</span>
                <div><div className="text-sm font-medium text-ink">{t.reason}</div><div className="text-xs text-ink-muted">{t.date}</div></div>
              </div>
              <span className={cn("font-bold", t.amount > 0 ? "text-success" : "text-danger")}>{t.amount > 0 ? "+" : ""}{toFa(t.amount)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
