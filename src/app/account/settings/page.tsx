"use client";
import { useState } from "react";
import { Bell, Globe, Moon, Shield, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { useUi, useAuth } from "@/stores/useApp";
import { useRouter } from "next/navigation";
import { DEFAULT_NOTIFICATION_PREFS, NOTIFICATION_LABELS, type NotificationType } from "@/config/notifications";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { toast } = useUi(); const { logout } = useAuth(); const router = useRouter();
  const [prefs, setPrefs] = useState({ notif: true, email: false, sms: true, dark: false });
  const [notifPrefs, setNotifPrefs] = useState(DEFAULT_NOTIFICATION_PREFS);
  const toggleNotif = (type: NotificationType) => {
    setNotifPrefs((cur) => cur.map((p) => p.type === type ? { ...p, enabled: !p.enabled } : p));
    toast("ترجیحات ذخیره شد");
  };
  const toggle = (k: keyof typeof prefs) => setPrefs((p) => ({ ...p, [k]: !p[k] }));

  const groups = [
    { icon: Bell, title: "اعلان‌ها", items: [["notif", "اعلان‌های درون‌برنامه‌ای"], ["email", "ایمیل بازاریابی"], ["sms", "پیامک سفارش"]] as const },
    { icon: Globe, title: "نمایش", items: [["dark", "حالت تیره (به‌زودی)"]] as const },
  ];

  return (
    <div className="space-y-6">
      <div className="card-surface p-6">
        <h1 className="font-display text-xl font-black text-ink">تنظیمات</h1>
        <div className="mt-5 space-y-6">
          {groups.map((g) => (
            <div key={g.title}>
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink"><g.icon size={16} /> {g.title}</div>
              <div className="space-y-1">
                {g.items.map(([k, label]) => (
                  <label key={k} className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-2.5 hover:bg-ivory-2">
                    <span className="text-sm text-ink">{label}</span>
                    <button type="button" onClick={() => toggle(k)} className={`relative h-6 w-11 rounded-full transition ${prefs[k] ? "bg-terracotta" : "bg-clay/60"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-cream transition-all ${prefs[k] ? "right-0.5" : "right-5"}`} /></button>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card-surface p-6">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink"><Shield size={16} /> امنیت و حریم خصوصی</div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => toast("تغییر رمز به‌زودی", "info")}>تغییر رمز عبور</Button>
          <Button variant="outline" onClick={() => toast("داده‌ها با موفقیت دریافت شدند", "info")}>دریافت داده‌های من</Button>
          <Button variant="ghost" className="text-danger" onClick={() => { logout(); toast("از حساب خارج شدی"); router.push("/"); }}><Trash2 size={15} /> خروج از حساب</Button>
        </div>
      </div>

      {/* NOTIFICATION PREFERENCES — re-engagement architecture */}
      <div className="card-surface p-6">
        <div className="mb-4 flex items-center gap-2 text-sm font-bold text-ink"><Bell size={16} /> ترجیحات اعلان‌ها</div>
        <p className="mb-4 text-xs text-ink-muted">تعیین کن چه اعلان‌هایی دریافت کنی. این تنظیمات وقتی backend وصل شه فعال می‌شن.</p>
        <div className="space-y-2">
          {NOTIFICATION_LABELS && Object.entries(NOTIFICATION_LABELS).map(([type, info]) => {
            const pref = notifPrefs.find((p) => p.type === type);
            const isOn = pref?.enabled ?? false;
            return (
              <label key={type} className="flex cursor-pointer items-center justify-between rounded-xl border border-clay/40 bg-ivory-2 p-3 transition hover:border-clay">
                <div>
                  <div className="text-sm font-medium text-ink">{info.title}</div>
                  <div className="text-[11px] text-ink-muted">{info.desc}</div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleNotif(type as NotificationType)}
                  aria-label={`فعال/غیرفعال: ${info.title}`}
                  className={cn("relative h-6 w-11 shrink-0 rounded-full transition", isOn ? "bg-terracotta" : "bg-clay/60")}
                >
                  <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-cream transition-all", isOn ? "right-0.5" : "right-5")} />
                </button>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
