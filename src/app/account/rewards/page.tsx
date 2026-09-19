"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Gift, Flame, Users, Copy, Sparkles, Wand2, ShoppingBag, Trophy, Loader2, Dices, CheckCircle2 } from "lucide-react";
import { Button, LogoBlock } from "@/components/ui/primitives";
import { useUi } from "@/stores/useApp";
import { useHasHydrated } from "@/lib/useHasHydrated";
import { toFa } from "@/lib/utils";
import {
  fetchGamificationState,
  spinDailyWheel,
  checkInToday,
  type GamificationStateDTO,
} from "@/lib/commerceClient";
import { DAILY_SPIN, BADGES } from "@/config/promotions";
import { useCredits } from "@/stores/useApp";

const BADGE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  sparkles: Sparkles,
  wand: Wand2,
  bag: ShoppingBag,
  flame: Flame,
  users: Users,
  gift: Gift,
};

/** Segment order must match the conic-gradient we draw. */
const SEGMENTS = DAILY_SPIN.segments;
const SEGMENT_ANGLE = 360 / SEGMENTS.length;

export default function RewardsPage() {
  const { toast } = useUi();
  const hydrated = useHasHydrated();
  const [state, setState] = useState<GamificationStateDTO | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "demo" | "auth">("loading");

  // wheel spin
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [spinResult, setSpinResult] = useState<{ label: string; credits: number } | null>(null);
  const wheelRef = useRef<HTMLDivElement>(null);

  // check-in
  const [checkingIn, setCheckingIn] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const res = await fetchGamificationState();
      if (!alive) return;
      if (res.ok) {
        setState(res.data.state);
        setLoadState("ready");
      } else if (res.status === 401) {
        setLoadState("auth");
      } else if ((res.status === 503 && res.code === "DEMO_MODE") || res.status === 0) {
        setLoadState("demo");
      } else {
        setLoadState("demo"); // honest degraded card, no fake data
      }
    })();
    return () => { alive = false; };
  }, []);

  const adoptBalance = (balanceAfter: number) => {
    if (balanceAfter >= 0) useCredits.getState().setBalance(balanceAfter);
  };

  const doSpin = async () => {
    if (spinning || state?.spin.available === false) return;
    setSpinning(true);
    setSpinResult(null);
    const res = await spinDailyWheel();
    if (!res.ok) {
      setSpinning(false);
      toast(res.message ?? "چرخش انجام نشد — دوباره تلاش کن", "error");
      return;
    }
    if (res.data.alreadySpun) {
      setSpinning(false);
      toast("امروز چرخاندی — فردا دوباره!", "info");
      setState((s) => (s ? { ...s, spin: { ...s.spin, available: false } } : s));
      return;
    }
    const segIndex = Math.max(0, SEGMENTS.findIndex((seg) => seg.key === res.data.segmentKey));
    // land the chosen segment under the top pointer with a little jitter
    const jitter = (Math.random() - 0.5) * (SEGMENT_ANGLE * 0.5);
    const target = 360 * 5 + (360 - segIndex * SEGMENT_ANGLE - SEGMENT_ANGLE / 2) + jitter;
    setRotation((prev) => prev + (target - (prev % 360)) + 360 * 2);
    setTimeout(() => {
      setSpinning(false);
      setSpinResult({ label: res.data.label, credits: res.data.credits });
      adoptBalance(res.data.balanceAfter);
      toast(`${res.data.label} برداشتی!`, "success");
      setState((s) => (s ? { ...s, spin: { available: false, todayCredits: res.data.credits, todayKey: res.data.segmentKey } } : s));
    }, 4200);
  };

  const doCheckIn = async () => {
    if (checkingIn || state?.streak.checkedInToday) return;
    setCheckingIn(true);
    const res = await checkInToday();
    setCheckingIn(false);
    if (!res.ok) {
      toast(res.message ?? "ثبت ورود انجام نشد", "error");
      return;
    }
    if (res.data.alreadyCheckedIn) {
      toast("امروز ثبت شده — فردا دوباره!", "info");
      return;
    }
    adoptBalance(res.data.balanceAfter);
    toast(`روز ${toFa(res.data.streak)} استریک — ${toFa(res.data.credits)} اعتبار گرفتی!`, "success");
    setState((s) =>
      s
        ? {
            ...s,
            streak: {
              ...s.streak,
              current: res.data.streak,
              checkedInToday: true,
              todayCredits: res.data.credits,
              totalCheckins: s.streak.totalCheckins + 1,
              longest: Math.max(s.streak.longest, res.data.streak),
            },
          }
        : s,
    );
  };

  const copyReferral = async () => {
    if (!state) return;
    const link = `${window.location.origin}/register?ref=${state.referral.code}`;
    try {
      await navigator.clipboard.writeText(link);
      toast("لینک دعوت کپی شد!", "success");
    } catch {
      toast("کپی نشد — کد را دستی بردار", "error");
    }
  };

  const gradient = `conic-gradient(${SEGMENTS.map(
    (seg, i) => `${seg.color} ${i * SEGMENT_ANGLE}deg ${(i + 1) * SEGMENT_ANGLE}deg`,
  ).join(", ")})`;

  return (
    <div className="space-y-6">
      <div className="card-surface flex flex-wrap items-center gap-4 p-6">
        <LogoBlock char="ج" color="var(--color-gold)" size={56} />
        <div className="flex-1">
          <h1 className="font-display text-xl font-bold text-ink">جایزه‌های هومینو</h1>
          <p className="text-sm text-ink-muted">هر روز بچرخان، وارد شو، دوستانت را دعوت کن — اعتبار واقعی استودیو بگیر.</p>
        </div>
        <Link href="/account" className="text-sm text-terracotta-deep">بازگشت به حساب ←</Link>
      </div>

      {loadState === "auth" && (
        <div className="card-surface p-6 text-center">
          <Trophy className="mx-auto mb-3 text-gold" size={28} />
          <p className="text-sm text-ink">برای دیدن جایزه‌ها وارد حساب شو.</p>
          <Link href="/login?next=/account/rewards"><Button className="mt-4">ورود</Button></Link>
        </div>
      )}

      {loadState === "demo" && (
        <div className="card-surface p-6 text-center">
          <p className="text-sm text-ink-muted">این بخش پس از اتصال به پایگاه‌داده فعال می‌شود — فعلاً حالت نمایشی است.</p>
        </div>
      )}

      {loadState === "ready" && state && (
        <>
          {/* چرخ شانس روزانه */}
          <div className="card-surface p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-bold text-ink"><Dices size={16} className="text-terracotta-deep" /> چرخ شانس روزانه</div>
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
              <div className="relative h-56 w-56 shrink-0">
                <div ref={wheelRef} className="absolute inset-0 rounded-full border-4 border-cream shadow-inner transition-transform duration-[4000ms] ease-[cubic-bezier(0.15,0.9,0.25,1)]" style={{ background: gradient, transform: `rotate(${rotation}deg)` }}>
                  {SEGMENTS.map((seg, i) => (
                    <span key={seg.key} className="absolute left-1/2 top-1/2 text-[10px] font-bold text-ink" style={{ transform: `rotate(${i * SEGMENT_ANGLE + SEGMENT_ANGLE / 2}deg) translateY(-88px) translateX(-50%)`, transformOrigin: "0 0" }}>
                      {seg.label}
                    </span>
                  ))}
                </div>
                <div className="absolute -top-2 left-1/2 h-5 w-5 -translate-x-1/2 rotate-45 bg-ink" aria-hidden />
                <div className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-cream bg-ink text-xs font-bold text-cream">هومینو</div>
              </div>
              <div className="flex-1 space-y-3">
                {state.spin.available && !spinResult ? (
                  <Button size="lg" onClick={doSpin} disabled={spinning} className="w-full sm:w-auto">
                    {spinning ? <><Loader2 className="animate-spin" size={16} /> در حال چرخش…</> : <>بچرخان — رایگان</>}
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 rounded-xl border border-sage/30 bg-sage/10 p-3 text-sm text-ink">
                    <CheckCircle2 size={16} className="text-sage" />
                    {spinResult ? `برنده شدی: ${spinResult.label}` : `امروز ${toFa(state.spin.todayCredits)} اعتبار از چرخ گرفتی — فردا دوباره!`}
                  </div>
                )}
                <p className="text-2xs leading-5 text-ink-muted">{DAILY_SPIN.oddsLabel}</p>
                <p className="text-2xs text-ink-muted">هر روز یک چرخ رایگان — جایزه‌ها اعتبار واقعی استودیو هستند و بلافاصله به حسابت اضافه می‌شوند.</p>
              </div>
            </div>
          </div>

          {/* استریک ورود روزانه */}
          <div className="card-surface p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-ink"><Flame size={16} className="text-terracotta-deep" /> ورود روزانه</div>
              <span className="text-xs text-ink-muted">طولانی‌ترین: {toFa(state.streak.longest)} روز</span>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1">
                <div className="mb-2 text-2xl font-bold text-ink">{toFa(state.streak.current)} روز پیوسته</div>
                <div className="flex gap-1.5">
                  {Array.from({ length: 7 }).map((_, i) => {
                    const day = i + 1;
                    const filled = state.streak.current >= day || (state.streak.checkedInToday && state.streak.current >= day);
                    return (
                      <div key={day} className={`h-2.5 flex-1 rounded-full ${filled ? "bg-terracotta" : "bg-clay/30"}`} title={`روز ${toFa(day)}`} />
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-ink-muted">
                  {state.streak.checkedInToday
                    ? `امروز ثبت شد (+${toFa(state.streak.todayCredits)} اعتبار) — جایزهٔ فردا: ${toFa(state.streak.nextReward)} اعتبار`
                    : `امروز ثبت کن و ${toFa(state.streak.nextReward)} اعتبار بگیر — یک روز غیبت، استریک صفر می‌شود`}
                </p>
              </div>
              <Button onClick={doCheckIn} disabled={checkingIn || state.streak.checkedInToday}>
                {checkingIn ? <Loader2 className="animate-spin" size={16} /> : state.streak.checkedInToday ? "ثبت شد ✓" : "ثبت ورود امروز"}
              </Button>
            </div>
          </div>

          {/* رفرال */}
          <div className="card-surface p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-bold text-ink"><Users size={16} className="text-sage" /> دعوت دوستان</div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1">
                <p className="text-sm text-ink">{state.referral.shareMessage}</p>
                <p className="mt-1 text-xs text-ink-muted">
                  بعد از اولین خرید دوستت، {toFa(50)} اعتبار تو و {toFa(30)} اعتبار او به‌صورت خودکار واریز می‌شود.
                  {state.referral.pending > 0 && ` (${toFa(state.referral.pending)} دعوت در انتظار اولین خرید)`}
                </p>
                <p className="mt-2 text-xs text-ink-muted">دعوت‌های موفق: {toFa(state.referral.credited)} · اعتبار کسب‌شده: {toFa(state.referral.creditsEarned)}</p>
              </div>
              <div className="flex items-center gap-2">
                <code className="rounded-xl border border-clay/50 bg-ivory-2 px-4 py-2.5 text-lg font-bold tracking-widest text-ink" dir="ltr">{state.referral.code}</code>
                <Button variant="outline" onClick={copyReferral}><Copy size={15} /> کپی لینک</Button>
              </div>
            </div>
          </div>

          {/* نشان‌ها */}
          <div className="card-surface p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-bold text-ink"><Trophy size={16} className="text-gold" /> نشان‌های تو</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {BADGES.map((badge) => {
                const earned = state.badges.some((b) => b.key === badge.key);
                const Icon = BADGE_ICONS[badge.icon] ?? Sparkles;
                return (
                  <div key={badge.key} className={`flex items-start gap-3 rounded-xl border p-3 transition ${earned ? "border-gold/40 bg-gold/10" : "border-clay/30 bg-ivory-2 opacity-60"}`}>
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${earned ? "bg-gold/20 text-gold" : "bg-clay/20 text-ink-muted"}`}><Icon size={17} /></span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-ink">{badge.title}</div>
                      <div className="text-2xs leading-4 text-ink-muted">{badge.description}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            {hydrated && state.badges.length === 0 && (
              <p className="mt-3 text-xs text-ink-muted">اولین نشان‌ها نزدیک‌اند — یک طراحی بزن یا امروز چرخ را بچرخان.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
