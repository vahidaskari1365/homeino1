"use client";
// Post a new second-hand ad from the customer profile.
import Link from "next/link";
import { ChevronRight, Tag } from "lucide-react";
import SecondHandAdForm from "@/components/ads/SecondHandAdForm";

export default function NewAdPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-black text-ink">ثبت آگهی دسته دوم</h1>
        <p className="text-sm text-ink-muted">کالایت را در دسته‌بندی خود سایت آگهی کن — بعد از ثبت، در بازار دسته دوم منتشر می‌شود.</p>
      </div>
      <div className="card-surface p-6">
        <div className="mb-5 flex items-center gap-2 text-sm font-bold text-ink"><Tag size={16} /> مشخصات کالا</div>
        <SecondHandAdForm />
      </div>
      <Link href="/account/ads" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"><ChevronRight size={15} /> بازگشت به آگهی‌های من</Link>
    </div>
  );
}
