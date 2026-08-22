import { redirect } from "next/navigation";

// The AI entry point is the Designer itself — no intermediate page.
// All AI navigation (Header, MobileNav, Hero, panels, CTAs) targets
// /ai/design directly; this route only forwards legacy /ai visits.
export default function AIPage() {
  redirect("/ai/design");
}
