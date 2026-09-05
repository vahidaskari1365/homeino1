import type { Metadata } from "next";

/** Design history is private user data — never indexed. */
export const metadata: Metadata = {
  title: "طراحی‌های من — هومینو استودیو",
  robots: { index: false, follow: false },
  alternates: { canonical: "/ai/history" },
};

export default function AiHistoryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
