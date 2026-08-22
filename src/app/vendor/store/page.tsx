"use client";
import { Button, LogoBlock } from "@/components/ui/primitives";
import { useUi } from "@/stores/useApp";
import { SmartImage } from "@/components/ui/SmartImage";
import { IMG } from "@/data/media";

export default function VendorStorePage() {
  const { toast } = useUi();
  const input = "w-full rounded-xl border border-clay/60 bg-cream p-2.5 text-sm outline-none focus:border-ink";
  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl font-black text-ink">تنظیمات فروشگاه</h1>
      <div className="card-surface p-6">
        <div className="mb-5"><SmartImage src={IMG.living2} alt="کاور" className="aspect-[4/1] w-full rounded-xl" /></div>
        <div className="-mt-10 mb-5 flex items-end gap-4"><div className="card-surface p-2"><LogoBlock char="ن" color="var(--color-terracotta)" size={64} /></div><Button variant="ghost" size="sm">تغییر لوگو</Button></div>
        <form onSubmit={(e) => { e.preventDefault(); toast("تغییرات ذخیره شد"); }} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="mb-1.5 block text-sm font-medium text-ink">نام فروشگاه</label><input defaultValue="نور مبلمان" className={input} /></div>
          <div className="sm:col-span-2"><label className="mb-1.5 block text-sm font-medium text-ink">توضیحات</label><textarea rows={2} defaultValue="طراحی و تولید مبلمان مدرن با متریال درجه یک." className={`${input} resize-none`} /></div>
          <div><label className="mb-1.5 block text-sm font-medium text-ink">شهر</label><input defaultValue="تهران" className={input} /></div>
          <div><label className="mb-1.5 block text-sm font-medium text-ink">شماره تماس</label><input defaultValue="021-12345678" className={input} /></div>
          <div className="sm:col-span-2"><Button type="submit">ذخیره</Button></div>
        </form>
      </div>
    </div>
  );
}
