import type { Metadata } from "next";

/** Canonical lives here (page-level) so /ai/history and /ai/result/[id] —
 *  which are noindex — don't inherit a wrong canonical from the layout. */
export const metadata: Metadata = {
  alternates: { canonical: "/ai/design" },
  robots: { index: true, follow: true },
};

export default function AiDesignLayout({ children }: { children: React.ReactNode }) {
  return children;
}
