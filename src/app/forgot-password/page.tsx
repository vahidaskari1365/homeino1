"use client";
import { useState } from "react";
import Link from "next/link";
import { Mail, ArrowRight, KeyRound } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button, Spinner } from "@/components/ui/primitives";
import { useUi } from "@/stores/useApp";

export default function ForgotPasswordPage() {
  const { toast } = useUi();
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) return toast("ایمیل معتبر نیست", "error");
    setLoading(true);
    setTimeout(() => { setSent(true); setLoading(false); }, 900);
  };

  return (
    <AuthShell title="بازیابی رمز عبور" subtitle="ایمیلت را وارد کن تا لینک بازیابی برایت ارسال شود." footer={<Link href="/login" className="inline-flex items-center gap-1 font-medium text-terracotta-deep"><ArrowRight size={15} /> بازگشت به ورود</Link>}>
      {sent ? (
        <div className="rounded-2xl border border-sage/30 bg-sage/8 p-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-sage/15 text-success"><KeyRound size={22} /></div>
          <h3 className="font-display font-bold text-ink">ایمیل ارسال شد</h3>
          <p className="mt-1 text-sm text-ink-muted">لینک بازیابی به <span className="font-medium text-ink">{email}</span> ارسال شد. (در محیط دمو، لینک واقعی فعال نیست.)</p>
          <Button variant="ghost" className="mt-4" onClick={() => setSent(false)}>تلاش دوباره</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">ایمیل</label>
            <div className="flex items-center rounded-xl border border-clay/60 bg-cream px-3 focus-within:border-ink">
              <Mail size={17} className="text-ink-muted" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ایمیل ثبت‌شده‌ات" className="flex-1 bg-transparent px-2.5 py-2.5 text-sm outline-none" />
            </div>
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={loading}>{loading ? <><Spinner /> در حال ارسال…</> : "ارسال لینک بازیابی"}</Button>
        </form>
      )}
    </AuthShell>
  );
}
