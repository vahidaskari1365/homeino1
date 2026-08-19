"use client";

import { Container } from "@/components/shared";
import { ErrorState } from "@/components/ui/primitives";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Container className="py-12 sm:py-20">
      <ErrorState title="این صفحه درست بارگذاری نشد" desc="اطلاعاتت محفوظ است. دوباره تلاش کن یا از دکمه بازگشت برای ادامه مسیر استفاده کن." onRetry={reset} />
    </Container>
  );
}
