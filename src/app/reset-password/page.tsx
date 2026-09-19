"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Lock, KeyRound } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button, Spinner } from "@/components/ui/primitives";
import { useUi, useAuth } from "@/stores/useApp";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Password-reset completion. Supabase's recovery link returns here with an
 * out-of-band session in the URL fragment (#access_token=…&refresh_token=…).
 * The browser client picks it up automatically (detectSessionInUrl), then
 * updateUser({ password }) sets the new credential against that session.
 */
export default function ResetPasswordPage() {
  const { toast } = useUi();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        // consume the recovery tokens from the URL fragment
        await supabase.auth.getSession();
        const { data } = await supabase.auth.getUser();
        if (!alive) return;
        setHasSession(Boolean(data.user));
        if (data.user) {
          // mirror the confirmed identity into the UI store
          const email = data.user.email;
          if (email) useAuth.getState().login(email, { id: data.user.id });
        }
      } catch {
        // public Supabase env missing (demo deploy) — show the form disabled
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (pwd.length < 6) return setErr("رمز حداقل ۶ کاراکتر است");
    if (pwd !== pwd2) return setErr("تکرار رمز مطابقت ندارد");
    setLoading(true);
    try {
      const { error } = await createSupabaseBrowserClient().auth.updateUser({ password: pwd });
      setLoading(false);
      if (error) {
        setErr("تغییر رمز انجام نشد — لینک شاید منقضی شده باشد");
        return;
      }
      toast("رمز عبور با موفقیت عوض شد");
      window.location.href = "/account";
    } catch {
      setLoading(false);
      setErr("اتصال برقرار نشد — دوباره تلاش کن");
    }
  };

  return (
    <AuthShell title="تعیین رمز جدید" subtitle="رمز جدیدت را انتخاب کن." footer={<Link href="/login" className="font-medium text-terracotta-deep">ورود</Link>}>
      {!ready ? (
        <div className="grid place-items-center py-10"><Spinner /></div>
      ) : !hasSession ? (
        <div className="rounded-2xl border border-clay/40 bg-cream p-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-clay/20 text-ink-muted"><KeyRound size={22} /></div>
          <h3 className="font-display font-bold text-ink">لینک بازیابی معتبر نیست</h3>
          <p className="mt-1 text-sm text-ink-muted">لینک منقضی یا استفاده‌شده است. دوباره درخواست لینک بده.</p>
          <Button className="mt-4" onClick={() => { window.location.href = "/forgot-password"; }}>درخواست لینک جدید</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-ink">رمز عبور جدید</label>
            <div className="flex items-center rounded-xl border border-clay/60 bg-cream px-3 focus-within:border-ink">
              <Lock size={17} className="text-ink-muted" />
              <input id="new-password" type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} className="flex-1 bg-transparent px-2.5 py-2.5 text-sm outline-none" />
            </div>
          </div>
          <div>
            <label htmlFor="new-password-2" className="mb-1.5 block text-sm font-medium text-ink">تکرار رمز جدید</label>
            <div className="flex items-center rounded-xl border border-clay/60 bg-cream px-3 focus-within:border-ink">
              <Lock size={17} className="text-ink-muted" />
              <input id="new-password-2" type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} className="flex-1 bg-transparent px-2.5 py-2.5 text-sm outline-none" />
            </div>
          </div>
          {err && <p role="alert" className="text-sm text-danger">{err}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={loading}>{loading ? <><Spinner /> در حال ثبت…</> : "ثبت رمز جدید"}</Button>
        </form>
      )}
    </AuthShell>
  );
}
