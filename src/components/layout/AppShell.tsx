"use client";
import type { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { MobileNav } from "./MobileNav";
import { SearchOverlay } from "./SearchOverlay";
import { AIPanel } from "./AIPanel";
import { GlobalChrome } from "./GlobalChrome";
import { ContextNavigation } from "./ContextNavigation";
import { TrackingProvider } from "@/lib/tracking";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <TrackingProvider>
      <Header />
      <ContextNavigation />
      <main id="main-content" className="min-h-[60vh] min-w-0 pb-24 lg:pb-0">{children}</main>
      <Footer />
      <MobileNav />
      <SearchOverlay />
      <AIPanel />
      <GlobalChrome />
    </TrackingProvider>
  );
}
