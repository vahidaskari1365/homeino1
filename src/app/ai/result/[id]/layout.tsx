import type { Metadata } from "next";

/** Generated result pages are private user data — never indexed. */
export const metadata: Metadata = {
  title: "نتیجه طراحی — هومینو استودیو",
  robots: { index: false, follow: false },
  alternates: { canonical: "/ai/result" },
};

export default function AiResultLayout({ children }: { children: React.ReactNode }) {
  return children;
}
