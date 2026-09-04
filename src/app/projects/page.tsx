"use client";
import Link from "next/link";
import { Container, PageHeader } from "@/components/shared";
import { SmartImage } from "@/components/ui/SmartImage";
import { Badge } from "@/components/ui/primitives";
import { RevealGroup, RevealItem } from "@/components/motion/Reveal";
import { projects } from "@/data/content";

export default function ProjectsPage() {
  return (
    <Container className="py-10">
      <PageHeader eyebrow="پروژه‌های طراحی" title="پروژه‌های واقعی Homeino" desc="نگاهی به طراحی‌های انجام‌شده توسط تیم و جامعه‌ی Homeino — با محصولاتی که می‌توانی بخری." />
      <RevealGroup className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {projects.map((p) => (
          <RevealItem key={p.id}>
            <Link href={`/projects/${p.id}`} className="group relative block overflow-hidden rounded-[var(--radius-xl)]">
              <SmartImage src={p.cover} alt={p.title} className="aspect-[4/3] w-full transition duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/20 to-transparent" />
              <div className="absolute bottom-0 p-6 text-cream">
                <div className="flex gap-2"><Badge tone="accent">{p.style}</Badge><Badge tone="dark">{p.room}</Badge></div>
                <h3 className="mt-2 font-display text-2xl font-black">{p.title}</h3>
                <p className="mt-1 text-sm text-cream/75">{p.client} · {p.area}</p>
              </div>
            </Link>
          </RevealItem>
        ))}
      </RevealGroup>
    </Container>
  );
}
