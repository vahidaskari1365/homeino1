import { Home, Search } from "lucide-react";
import { Container, ButtonLink } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <Container className="flex min-h-[65vh] flex-col items-center justify-center py-16 text-center">
      <div className="text-gold-gradient font-display text-8xl font-black">۴۰۴</div>
      <h1 className="mt-4 text-2xl font-black text-ink">این صفحه پیدا نشد</h1>
      <p className="mt-2 max-w-sm text-pretty text-sm text-ink-muted">شاید آدرس تغییر کرده باشد. از مسیرهای زیر ادامه بده؛ هیچ بن‌بستی در Homeino نیست.</p>
      <div className="mt-6 flex w-full max-w-sm flex-col gap-3 sm:flex-row sm:justify-center">
        <ButtonLink href="/"><Home size={16} /> بازگشت به خانه</ButtonLink>
        <ButtonLink href="/products" variant="ghost"><Search size={16} /> کاوش محصولات</ButtonLink>
      </div>
    </Container>
  );
}
