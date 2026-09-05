"use client";
import { useState } from "react";
import { Bell, Globe, Shield, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { useUi, useAuth } from "@/stores/useApp";
import { useRouter } from "next/navigation";
import { DEFAULT_NOTIFICATION_PREFS, NOTIFICATION_LABELS, type NotificationType } from "@/config/notifications";
import { useHasHydrated } from "@/lib/useHasHydrated";
import { cn } from "@/lib/utils";

// Toggles persist across reloads in their own localStorage record.
const SETTINGS_KEY = "homeino-settings";
type SettingsPrefs = { notif: boolean; email: boolean; sms: boolean; dark: boolean };
const DEFAULTS: SettingsPrefs = { notif: true, email: false, sms: true, dark: false };

function readPrefs(): SettingsPrefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<SettingsPrefs>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function writePrefs(prefs: SettingsPrefs) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(prefs));
  } catch { /* private mode */ }
}

/** "دریافت داده‌های من" — real download of every homeino-* record in this browser. */
function downloadMyData() {
  if (typeof window === "undefined") return;
  const data: Record<string, unknown> = { exportedAt: new Date().toISOString(), note: "خروجی دمو از داده‌های ذخیره‌شده در همین مرورگر" };
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key?.startsWith("homeino")) continue;
    try {
      data[key] = JSON.parse(window.localStorage.getItem(key) ?? "");
    } catch {
      data[key] = window.localStorage.getItem(key);
    }
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "homeino-my-data.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function SettingsPage() {
  const { toast } = useUi(); const { logout } = useAuth(); const router = useRouter();
  const hydrated = useHasHydrated();
  const [version, setVersion] = useState(0);
  const [notifPrefs, setNotifPrefs] = useState(DEFAULT_NOTIFICATION_PREFS);
  // Derived read: defaults for SSR/first paint, persisted values after
  // hydration. `version` forces the re-read after each toggle.
  const prefs = (() => {
    void version;
    return hydrated ? readPrefs() : DEFAULTS;
  })();
  const toggle = (k: keyof SettingsPrefs) => {
    const next = { ...prefs, [k]: !prefs[k] };
    writePrefs(next);
    setVersion((v) => v + 1);
  };
  const toggleNotif = (type: NotificationType) => {
    setNotifPrefs((cur) => cur.map((p) => p.type === type ? { ...p, enabled: !p.enabled } : p));
    toast("ترجیحات ذخیره شد");
  };

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
          <Button variant="outline" onClick={() => { downloadMyData(); toast("فایل داده‌های تو دانلود شد"); }}><Download size={15} /> دریافت داده‌های من</Button>
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
