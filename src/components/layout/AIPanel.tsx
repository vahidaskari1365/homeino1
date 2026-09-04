"use client";
import { useEffect, useRef, useState } from "react";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { useRouter, usePathname } from "next/navigation";
import { X, Sparkles, Send, ImagePlus, Wand2, Heart } from "lucide-react";
import { useUi, useChat } from "@/stores/useApp";
import { aiService } from "@/services/ai";

const QUICK = [
  { label: "اتاق من رو مدرن کن", icon: Wand2 },
  { label: "برای مبل کرم فرش مناسب پیدا کن", icon: Sparkles },
  { label: "این محصول رو با دکوراسیونم هماهنگ کن", icon: Heart },
];

export function AIPanel() {
  const { aiPanelOpen, setAiPanel } = useUi();
  const { messages, push, update } = useChat();
  const router = useRouter();
  const pathname = usePathname();

  // Build context string so the AI knows where the user is
  const buildContext = (): string => {
    if (pathname.startsWith("/products/")) return `محصول: ${decodeURIComponent(pathname.split("/products/")[1])}`;
    if (pathname.startsWith("/stores/")) return `فروشگاه: ${decodeURIComponent(pathname.split("/stores/")[1])}`;
    if (pathname.startsWith("/inspiration/")) return `الهام: در حال مشاهده ایده دکوراسیون`;
    if (pathname.startsWith("/ai/")) return `استودیو طراحی هوش مصنوعی`;
    if (pathname === "/") return `صفحه اصلی Homeino`;
    return `صفحه: ${pathname}`;
  };
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  useFocusTrap(aiPanelOpen, panelRef);

  useEffect(() => {
    document.body.style.overflow = aiPanelOpen ? "hidden" : "";
  }, [aiPanelOpen]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 9e9, behavior: "smooth" });
  }, [messages]);

  if (!aiPanelOpen) return null;

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    setInput("");
    push({ role: "user", content: text });
    const pendingId = push({ role: "assistant", content: "…", pending: true });
    setBusy(true);
    try {
      const reply = await aiService.chat({ message: text, context: buildContext() });
      update(pendingId, { content: reply.content, pending: false });
    } catch {
      update(pendingId, { content: "خطایی پیش اومد، دوباره تلاش کن.", pending: false });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-ink/40 backdrop-blur-sm" onClick={() => setAiPanel(false)}>
      <aside
        className="flex h-full w-full max-w-md flex-col bg-cream shadow-[var(--shadow-lift)] animate-[fadeUp_0.35s_ease]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between border-b border-clay/40 bg-gradient-to-l from-ink to-ink-soft px-5 py-4 text-cream">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-terracotta"><Sparkles size={18} /></span>
            <div>
              <div className="font-display font-bold">دستیار هوشمند Homeino</div>
              <div className="text-[11px] opacity-70">هر سؤالی درباره‌ی دکوراسیون داری بپرس</div>
            </div>
          </div>
          <button onClick={() => setAiPanel(false)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white/10" aria-label="بستن"><X size={20} /></button>
        </div>

        {/* messages */}
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-5">
          {messages.map((m) => (
            <div key={m.id} className={m.role === "user" ? "flex justify-start" : "flex justify-end"}>
              <div className={m.role === "user"
                ? "max-w-[85%] rounded-2xl rounded-tr-sm bg-sand/70 px-4 py-2.5 text-sm text-ink"
                : "max-w-[85%] rounded-2xl rounded-tl-sm bg-ink px-4 py-2.5 text-sm text-cream"}>
                {m.content}
              </div>
            </div>
          ))}
        </div>

        {/* quick actions */}
        <div className="flex flex-wrap gap-2 px-5 pb-2">
          {QUICK.map((q) => (
            <button key={q.label} onClick={() => send(q.label)} className="flex items-center gap-1.5 rounded-full border border-clay/60 bg-ivory-2 px-3 py-1.5 text-xs text-ink transition hover:border-ink">
              <q.icon size={13} /> {q.label}
            </button>
          ))}
        </div>

        {/* input */}
        <div className="border-t border-clay/40 p-4">
          <div className="flex items-end gap-2 rounded-2xl border border-clay/60 bg-cream p-2 focus-within:border-ink">
            <button onClick={() => router.push("/ai/design")} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-ink-muted transition hover:bg-ivory-2" aria-label="آپلود تصویر">
              <ImagePlus size={18} />
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              rows={1}
              placeholder="پیامت رو بنویس…"
              className="max-h-28 flex-1 resize-none bg-transparent py-1.5 text-sm text-ink outline-none placeholder:text-ink-muted/60"
            />
            <button onClick={() => send(input)} disabled={busy || !input.trim()} className="btn-accent grid h-9 w-9 shrink-0 place-items-center rounded-xl disabled:opacity-40" aria-label="ارسال">
              <Send size={16} />
            </button>
          </div>
          <button onClick={() => { setAiPanel(false); router.push("/ai/design"); }} className="mt-2 w-full text-center text-xs text-terracotta-deep hover:underline">
            ورود به AI استودیو ←
          </button>
        </div>
      </aside>
    </div>
  );
}
