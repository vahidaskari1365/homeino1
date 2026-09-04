"use client";
import type { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { MobileNav } from "./MobileNav";
import { SearchOverlay } from "./SearchOverlay";
import { AIPanel } from "./AIPanel";
import { GlobalChrome } from "./GlobalChrome";
import { TrackingProvider } from "@/lib/tracking";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <TrackingProvider>
      <Header />
      <main id="main-content" tabIndex={-1} className="min-h-[60vh] pb-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:pb-0">{children}</main>
      <Footer />
      <MobileNav />
      <SearchOverlay />
      <AIPanel />
      <GlobalChrome />
    </TrackingProvider>
  );
}
