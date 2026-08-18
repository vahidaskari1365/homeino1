"use client";
import { useState } from "react";
import { Container, PageHeader } from "@/components/shared";
import { Chip } from "@/components/ui/primitives";
import { InspirationCard } from "@/components/cards";
import { inspirations } from "@/data/inspirations";
import { styles } from "@/data/styles";
import { toFa } from "@/lib/utils";

export default function InspirationPage() {
  const [style, setStyle] = useState<string>("all");
  const [room, setRoom] = useState<string>("all");
  const rooms = Array.from(new Set(inspirations.map((i) => i.room)));
  const list = inspirations.filter((i) => (style === "all" || i.styleSlug === style) && (room === "all" || i.room === room));

  return (
    <Container className="py-10">
      <PageHeader eyebrow="الهام" title="گالری ایده‌های دکوراسیون" desc={`${toFa(inspirations.length)} طراحی واقعی. روی هر تصویر کلیک کن تا محصولاتی که داخلش هست را ببینی.`} />

      <div className="mb-8 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-ink-muted">سبک:</span>
          <Chip active={style === "all"} onClick={() => setStyle("all")}>همه</Chip>
          {styles.map((s) => <Chip key={s.slug} active={style === s.slug} onClick={() => setStyle(s.slug)}>{s.name}</Chip>)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-ink-muted">فضا:</span>
          <Chip active={room === "all"} onClick={() => setRoom("all")}>همه</Chip>
          {rooms.map((r) => <Chip key={r} active={room === r} onClick={() => setRoom(r)}>{r}</Chip>)}
        </div>
      </div>

      <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 [&>*]:mb-4">
        {list.map((insp, i) => <InspirationCard key={insp.id} insp={insp} index={i} />)}
      </div>
    </Container>
  );
}
