"use client";
import { useState } from "react";
import { Button, LogoBlock } from "@/components/ui/primitives";
import { useAuth, useUi } from "@/stores/useApp";

// Demo profile persistence: name/email go to the persisted auth store (the
// header badge updates instantly); phone/city live in their own localStorage
// profile record — both refill on the next visit. No fake success toast.
const PROFILE_KEY = "homeino-profile";

type StoredProfile = { phone: string; city: string };

function readStoredProfile(): StoredProfile {
  if (typeof window === "undefined") return { phone: "", city: "" };
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as StoredProfile) : { phone: "", city: "" };
  } catch {
    return { phone: "", city: "" };
  }
}

export default function ProfilePage() {
  const user = useAuth((s) => s.user); const updateProfile = useAuth((s) => s.updateProfile); const { toast } = useUi();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const stored = readStoredProfile();
  const [phone, setPhone] = useState(stored.phone);
  const [city, setCity] = useState(stored.city);

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast("نام را وارد کن", "error"); return; }
    updateProfile({ name, email });
    try {
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify({ phone, city } satisfies StoredProfile));
    } catch { /* private mode — demo keeps working */ }
    toast("پروفایل ذخیره شد — نام در هدر سایت هم به‌روز شد");
  }

  return (
    <div className="space-y-6">
      <div className="card-surface p-6">
        <div className="mb-6 flex items-center gap-4">
          <LogoBlock char={user?.avatar ?? "م"} color="var(--color-ink)" size={64} />
          <div><h1 className="font-display text-xl font-black text-ink">پروفایل من</h1><p className="text-sm text-ink-muted">اطلاعات حسابت را به‌روز نگه دار</p></div>
        </div>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          {[["نام و نام خانوادگی", name, setName], ["ایمیل", email, setEmail], ["شماره موبایل", phone, setPhone], ["شهر", city, setCity]].map(([label, val, set]) => (
            <div key={label as string}>
              <label className="mb-1.5 block text-sm font-medium text-ink">{label as string}</label>
              <input value={val as string} onChange={(e) => (set as (v: string) => void)(e.target.value)} className="w-full rounded-xl border border-clay/60 bg-cream p-2.5 text-sm outline-none focus:border-ink" />
            </div>
          ))}
          <div className="sm:col-span-2"><Button type="submit">ذخیره تغییرات</Button></div>
        </form>
      </div>
    </div>
  );
}
