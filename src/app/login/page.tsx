"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button, Spinner } from "@/components/ui/primitives";
import { useAuth, useUi } from "@/stores/useApp";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth(); const { toast } = useUi();
  const [email, setEmail] = useState("demo@homeino.ir");
  const [pwd, setPwd] = useState("12345678");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) return setErr("ایمیل معتبر نیست");
    if (pwd.length < 6) return setErr("رمز حداقل ۶ کاراکتر است");
    setLoading(true);
    setTimeout(() => { login(email); toast("خوش آمدی!"); router.push("/account"); }, 900);
  };

  return (
    <AuthShell title="ورود به Homeino" subtitle="وارد شو تا طراحی‌ها، علاقه‌مندی‌ها و سفارش‌هایت را ببینی." footer={<>حساب نداری؟ <Link href="/register" className="font-medium text-terracotta-deep">ثبت‌نام کن</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field icon={Mail} label="ایمیل" type="email" value={email} onChange={setEmail} />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">رمز عبور</label>
          <div className="flex items-center rounded-xl border border-clay/60 bg-cream px-3 focus-within:border-ink">
            <Lock size={17} className="text-ink-muted" />
            <input type={show ? "text" : "password"} value={pwd} onChange={(e) => setPwd(e.target.value)} className="flex-1 bg-transparent px-2.5 py-2.5 text-sm outline-none" />
            <button type="button" onClick={() => setShow(!show)} className="text-ink-muted">{show ? <EyeOff size={17} /> : <Eye size={17} />}</button>
          </div>
        </div>
        <div className="flex justify-between text-sm">
          <label className="flex items-center gap-2 text-ink-muted"><input type="checkbox" className="accent-terracotta" /> مرا به خاطر بسپار</label>
          <Link href="/forgot-password" className="text-terracotta-deep hover:underline">رمز را فراموش کرده‌ای؟</Link>
        </div>
        {err && <p className="text-sm text-danger">{err}</p>}
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
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-ink">{label}</label>
      <div className={cn("flex items-center rounded-xl border border-clay/60 bg-cream px-3 focus-within:border-ink")}>
        <Icon size={17} className="text-ink-muted" />
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 bg-transparent px-2.5 py-2.5 text-sm outline-none" />
      </div>
    </div>
  );
}
