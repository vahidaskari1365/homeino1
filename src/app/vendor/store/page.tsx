"use client";
import { useState } from "react";
import { Button, LogoBlock } from "@/components/ui/primitives";
import { useUi } from "@/stores/useApp";
import { SmartImage } from "@/components/ui/SmartImage";
import { vendorStoreProfile, updateVendorStoreProfile } from "@/data/vendorSession";

const input = "w-full rounded-xl border border-clay/60 bg-cream p-2.5 text-sm outline-none focus:border-ink";

export default function VendorStorePage() {
  const { toast } = useUi();
  const [profile, setProfile] = useState(vendorStoreProfile());

  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl font-black text-ink">تنظیمات فروشگاه</h1>
      <div className="card-surface p-6">
        <div className="mb-5"><SmartImage src={profile.cover} alt="کاور" className="aspect-[4/1] w-full rounded-xl" /></div>
        <div className="-mt-10 mb-5 flex items-end gap-4">
          <div className="card-surface p-2"><LogoBlock char={profile.logoChar} color={profile.logoColor} size={64} /></div>
          <span className="mb-2 text-xs text-ink-muted">{profile.city} · پاسخ‌گویی {profile.responseTime}</span>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const next = updateVendorStoreProfile({
          name: String(fd.get("name") ?? ""),
          description: String(fd.get("description") ?? ""),
          city: String(fd.get("city") ?? ""),
          phone: String(fd.get("phone") ?? ""),
          logoChar: String(fd.get("logoChar") ?? ""),
          cover: String(fd.get("cover") ?? ""),
          shippingPolicy: String(fd.get("shippingPolicy") ?? ""),
          returnPolicy: String(fd.get("returnPolicy") ?? ""),
        }); setProfile(next); toast("تغییرات فروشگاه در همین دمو ذخیره شد"); }} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="mb-1.5 block text-sm font-medium text-ink">نام فروشگاه</label><input name="name" defaultValue={profile.name} className={input} /></div>
          <div className="sm:col-span-2"><label className="mb-1.5 block text-sm font-medium text-ink">توضیحات</label><textarea name="description" rows={2} defaultValue={profile.description} className={`${input} resize-none`} /></div>
          <div className="sm:col-span-2"><label className="mb-1.5 block text-sm font-medium text-ink">کاراکتر لوگو</label><input name="logoChar" defaultValue={profile.logoChar} maxLength={1} className={input} dir="rtl" /></div>
          <div className="sm:col-span-2"><label className="mb-1.5 block text-sm font-medium text-ink">کاور فروشگاه (آدرس تصویر)</label><input name="cover" defaultValue={profile.cover} className={input} dir="ltr" /></div>
          <div><label className="mb-1.5 block text-sm font-medium text-ink">شهر</label><input name="city" defaultValue={profile.city} className={input} /></div>
          <div><label className="mb-1.5 block text-sm font-medium text-ink">شماره تماس</label><input name="phone" defaultValue={profile.phone} className={input} /></div>
          <div className="sm:col-span-2"><label className="mb-1.5 block text-sm font-medium text-ink">سیاست ارسال</label><textarea name="shippingPolicy" rows={2} defaultValue={profile.shippingPolicy} className={`${input} resize-none`} /></div>
          <div className="sm:col-span-2"><label className="mb-1.5 block text-sm font-medium text-ink">سیاست بازگشت</label><textarea name="returnPolicy" rows={2} defaultValue={profile.returnPolicy} className={`${input} resize-none`} /></div>
          <div className="sm:col-span-2"><Button type="submit">ذخیره</Button></div>
        </form>
      </div>
    </div>
  );
}
