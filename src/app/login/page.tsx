"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button, Spinner } from "@/components/ui/primitives";
import { useAuth, useUi } from "@/stores/useApp";
import { loginRequest } from "@/lib/commerceClient";
import { cn } from "@/lib/utils";

function readRememberFlag(): boolean {
  if (typeof window === "undefined") return false;
  try { return window.localStorage.getItem("homeino-remember") === "1"; } catch { return false; }
}

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth(); const { toast } = useUi();
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  // Remember-me is a real persisted flag, derived (not effect-set) to keep
  // the first paint identical to SSR.
  const [rememberOverride, setRememberOverride] = useState<boolean | null>(null);
  const remember = rememberOverride ?? Boolean(readRememberFlag());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) return setErr("ایمیل معتبر نیست");
    if (pwd.length < 6) return setErr("رمز حداقل ۶ کاراکتر است");
    setLoading(true);
    // ---- Real backend first (Supabase session + httpOnly cookies).
    const res = await loginRequest(email, pwd);
    if (res.ok) {
      login(email, { name: res.data.user?.name || email.split("@")[0] });
      toast("خوش آمدی!");
      router.push(nextPath());
      return;
    }
    // Real server rejection (wrong credentials on a live backend) — honest error.
    if (res.status === 400 || res.status === 403) {
      setLoading(false);
      setErr(res.message ?? "ایمیل یا رمز عبور درست نیست");
      return;
    }
    // Server unavailable (demo mode / network) → honest local demo session.
    login(email);
    toast("حالت دمو: ورود محلی انجام شد", "info");
    router.push(nextPath());
  };

  function nextPath(): string {
    try {
      const p = new URLSearchParams(window.location.search).get("next");
      return p && p.startsWith("/") ? p : "/account";
    } catch { return "/account"; }
  }

  return (
    <AuthShell title="ورود به Homeino" subtitle="وارد شو تا طراحی‌ها، علاقه‌مندی‌ها و سفارش‌هایت را ببینی." footer={<>حساب نداری؟ <Link href="/register" className="font-medium text-terracotta-deep">ثبت‌نام کن</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field icon={Mail} label="ایمیل" type="email" value={email} onChange={setEmail} />
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink">رمز عبور</label>
          <div className="flex items-center rounded-xl border border-clay/60 bg-cream px-3 focus-within:border-ink">
            <Lock size={17} className="text-ink-muted" />
            <input id="password" type={show ? "text" : "password"} value={pwd} onChange={(e) => setPwd(e.target.value)} className="flex-1 bg-transparent px-2.5 py-2.5 text-sm outline-none" />
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? "پنهان کردن رمز" : "نمایش رمز"} className="text-ink-muted">{show ? <EyeOff size={17} /> : <Eye size={17} />}</button>
          </div>
        </div>
        <div className="flex justify-between text-sm">
          <label className="flex items-center gap-2 text-ink-muted"><input type="checkbox" checked={remember} onChange={(e) => { setRememberOverride(e.target.checked); try { window.localStorage.setItem("homeino-remember", e.target.checked ? "1" : "0"); } catch { /* private mode */ } }} className="accent-terracotta" /> مرا به خاطر بسپار</label>
          <Link href="/forgot-password" className="text-terracotta-deep hover:underline">رمز را فراموش کرده‌ای؟</Link>
        </div>
        {err && <p role="alert" className="text-sm text-danger">{err}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={loading}>{loading ? <><Spinner /> در حال ورود…</> : "ورود"}</Button>
        <div className="flex items-center gap-3 py-1 text-xs text-ink-muted"><span className="h-px flex-1 bg-clay/50" /> یا <span className="h-px flex-1 bg-clay/50" /></div>
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="outline" onClick={() => toast("ورود با گوگل به‌زودی", "info")}>گوگل</Button>
          <Button type="button" variant="outline" onClick={() => toast("ورود با پیامک به‌زودی", "info")}>پیامک (OTP)</Button>
        </div>
      </form>
    </AuthShell>
  );
}

function Field({ icon: Icon, label, type, value, onChange }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; type: string; value: string; onChange: (v: string) => void }) {
  const id = label === "ایمیل" ? "email" : `field-${label}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">{label}</label>
      <div className={cn("flex items-center rounded-xl border border-clay/60 bg-cream px-3 focus-within:border-ink")}>
        <Icon size={17} className="text-ink-muted" />
        <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 bg-transparent px-2.5 py-2.5 text-sm outline-none" />
      </div>
    </div>
  );
}
