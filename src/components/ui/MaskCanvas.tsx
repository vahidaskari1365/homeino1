"use client";
import { useRef, useState, useEffect, useCallback } from "react";
import { Brush, Eraser, RotateCcw, Check, X } from "lucide-react";

/**
 * Overlay / Mask canvas — user paints the region of the photo that should
 * change (e.g. curtains). Only the masked area is edited; the rest of the
 * uploaded image is preserved. Emits a base64 PNG mask (white = edit area).
 */
export function MaskCanvas({ imageSrc, onConfirm, onCancel }: { imageSrc: string; onConfirm: (maskBase64: string) => void; onCancel: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [brush, setBrush] = useState(34);
  const [erase, setErase] = useState(false);
  const [dim, setDim] = useState({ w: 560, h: 360 });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const maxW = 560;
      const scale = Math.min(1, maxW / img.width);
      const w = Math.max(280, Math.round(img.width * scale));
      const h = Math.round(img.height * scale);
      setDim({ w, h });
      const bg = bgRef.current!;
      bg.width = w; bg.height = h;
      const bctx = bg.getContext("2d")!;
      bctx.drawImage(img, 0, 0, w, h);
      // dim the image slightly so the painted overlay is visible
      bctx.fillStyle = "rgba(0,0,0,0.35)";
      bctx.fillRect(0, 0, w, h);
      const mk = maskRef.current!;
      mk.width = w; mk.height = h;
      setReady(true);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  const getPos = useCallback((e: React.PointerEvent) => {
    const r = maskRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * dim.w, y: ((e.clientY - r.top) / r.height) * dim.h };
  }, [dim]);

  const stroke = (x: number, y: number) => {
    const ctx = maskRef.current!.getContext("2d")!;
    ctx.globalCompositeOperation = erase ? "destination-out" : "source-over";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(16,185,129,0.55)";
    ctx.fillStyle = "rgba(16,185,129,0.55)";
    ctx.lineWidth = brush;
    if (last.current) {
      ctx.beginPath();
      ctx.moveTo(last.current.x, last.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, brush / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    last.current = { x, y };
  };

  const onDown = (e: React.PointerEvent) => { drawing.current = true; last.current = null; const p = getPos(e); stroke(p.x, p.y); (e.target as Element).setPointerCapture?.(e.pointerId); };
  const onMove = (e: React.PointerEvent) => { if (!drawing.current) return; const p = getPos(e); stroke(p.x, p.y); };
  const onUp = () => { drawing.current = false; last.current = null; };

  const clearMask = () => { const ctx = maskRef.current!.getContext("2d")!; ctx.clearRect(0, 0, dim.w, dim.h); };

  const confirm = () => {
    // Build a pure mask: white where painted, black elsewhere (same dims as image)
    const mk = maskRef.current!;
    const src = mk.getContext("2d")!.getImageData(0, 0, dim.w, dim.h);
    const out = document.createElement("canvas");
    out.width = dim.w; out.height = dim.h;
    const octx = out.getContext("2d")!;
    octx.fillStyle = "#000"; octx.fillRect(0, 0, dim.w, dim.h);
    const od = octx.getImageData(0, 0, dim.w, dim.h);
    for (let i = 0; i < src.data.length; i += 4) {
      if (src.data[i + 3] > 10) { od.data[i] = 255; od.data[i + 1] = 255; od.data[i + 2] = 255; od.data[i + 3] = 255; }
    }
    octx.putImageData(od, 0, 0);
    onConfirm(out.toDataURL("image/png"));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-slate-950/70 p-2 text-xs text-slate-300">
        <span className="font-bold text-emerald-300">روی بخشی که می‌خواهی تغییر کند بکش</span>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setErase(false)} className={!erase ? "rounded-md bg-emerald-500 p-1.5 text-slate-950" : "rounded-md bg-slate-800 p-1.5 text-slate-300"} title="قلم مو"><Brush size={14} /></button>
          <button onClick={() => setErase(true)} className={erase ? "rounded-md bg-emerald-500 p-1.5 text-slate-950" : "rounded-md bg-slate-800 p-1.5 text-slate-300"} title="پاک‌کن"><Eraser size={14} /></button>
          <button onClick={clearMask} className="rounded-md bg-slate-800 p-1.5 text-slate-300 hover:text-white" title="پاک کردن"><RotateCcw size={14} /></button>
        </div>
      </div>
      <div className="flex items-center gap-2 text-2xs text-slate-400">
        <span>اندازه قلم:</span>
        <input type="range" min={10} max={80} value={brush} onChange={(e) => setBrush(+e.target.value)} className="w-40 accent-emerald-500" />
      </div>
      <div ref={wrapRef} className="relative mx-auto overflow-hidden rounded-2xl border border-emerald-500/40 bg-black" style={{ width: dim.w, height: dim.h, maxWidth: "100%" }}>
        <canvas ref={bgRef} className="absolute inset-0 h-full w-full" />
        <canvas ref={maskRef} className="absolute inset-0 h-full w-full touch-none" style={{ cursor: "crosshair" }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} />
        {!ready && <div className="absolute inset-0 grid place-items-center text-xs text-slate-500">در حال بارگذاری تصویر…</div>}
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="flex items-center gap-1 rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700"><X size={14} /> انصراف</button>
        <button onClick={confirm} disabled={!ready} className="flex items-center gap-1 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black text-slate-950 disabled:opacity-40"><Check size={14} /> تأیید و ویرایش فقط این بخش</button>
      </div>
    </div>
  );
}
