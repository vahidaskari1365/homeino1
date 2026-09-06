"use client";
import { useState } from "react";
import { Camera, ImagePlus, RotateCcw } from "lucide-react";
import { Container, PageHeader } from "@/components/shared";
import { Chip, Button, EmptyState } from "@/components/ui/primitives";
import { InspirationCard } from "@/components/cards";
import { UploadModal } from "@/components/inspiration/UploadModal";
import { getAllInspirations } from "@/data/inspirations";
import { styles } from "@/data/styles";
import { toFa } from "@/lib/utils";

/** Fixed space taxonomy — deliberately NOT derived from data. */
const SPACES = ["پذیرایی", "اتاق خواب", "فضای کار", "ناهارخوری", "بیرونی"] as const;

export default function InspirationPage() {
  const [style, setStyle] = useState<string>("all");
  const [room, setRoom] = useState<string>("all");
  const [uploadOpen, setUploadOpen] = useState(false);

  const pins = getAllInspirations();
  const list = pins.filter(
    (i) => (style === "all" || i.styleSlug === style) && (room === "all" || i.room === room)
  );
  const filtered = style !== "all" || room !== "all";

  return (
    <Container className="py-10">
      <PageHeader
        eyebrow="الهام"
        title="پین‌های الهام‌بخش چیدمان"
        desc="هر روز پین‌های تازه از سردبیر هومینو و کاربران؛ بگرد، ذخیره کن و عکس خانه‌ات را هم با بقیه به اشتراک بگذار."
      />

      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-ink-muted">سبک:</span>
          <Chip active={style === "all"} onClick={() => setStyle("all")}>همه</Chip>
          {styles.map((s) => <Chip key={s.slug} active={style === s.slug} onClick={() => setStyle(s.slug)}>{s.name}</Chip>)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-ink-muted">فضا:</span>
          <Chip active={room === "all"} onClick={() => setRoom("all")}>همه</Chip>
          {SPACES.map((r) => <Chip key={r} active={room === r} onClick={() => setRoom(r)}>{r}</Chip>)}
        </div>
      </div>

      <p className="mb-4 text-xs text-ink-muted" aria-live="polite">
        {filtered ? `${toFa(list.length)} پین از ${toFa(pins.length)}` : `${toFa(list.length)} پین`}
      </p>

      {list.length === 0 ? (
        <EmptyState
          icon={<Camera size={28} />}
          title="پینی با این فیلترها پیدا نشد"
          desc="فیلترها را عوض کن، یا اگر خانه‌ی خوش‌چیدمانی داری، اولین پین این دسته را خودت منتشر کن."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => { setStyle("all"); setRoom("all"); }}
              >
                <RotateCcw size={15} /> نمایش همه پین‌ها
              </Button>
              <Button onClick={() => setUploadOpen(true)}>
                <ImagePlus size={15} /> به اشتراک بگذار
              </Button>
            </div>
          }
        />
      ) : (
        <div className="columns-2 gap-3 sm:columns-3 sm:gap-4 lg:columns-4 xl:columns-5 [&>*]:mb-3 sm:[&>*]:mb-4">
          {/* upload CTA — first pin of the grid */}
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="group flex aspect-[4/5] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-clay/70 bg-cream/60 p-4 text-center transition hover:border-terracotta hover:bg-cream"
          >
            <span className="grid h-12 w-12 place-items-center rounded-full bg-sand/60 text-terracotta-deep transition group-hover:bg-terracotta group-hover:text-cream">
              <ImagePlus size={22} />
            </span>
            <span className="font-display text-sm font-black leading-6 text-ink">عکس خانه‌ات را به اشتراک بگذار</span>
            <span className="text-2xs leading-5 text-ink-muted">پین تو بعد از تأیید سردبیر در گالری منتشر می‌شود</span>
          </button>
          {list.map((insp, i) => <InspirationCard key={insp.id} insp={insp} index={i + 1} />)}
        </div>
      )}

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} spaces={[...SPACES]} />
    </Container>
  );
}
