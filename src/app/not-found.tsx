import Link from "next/link";
import { Home, Search } from "lucide-react";
import { Container, Button } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <Container className="flex min-h-[70vh] flex-col items-center justify-center py-20 text-center">
      <div className="font-display text-8xl font-black text-sand-2">۴۰۴</div>
      <h1 className="mt-4 font-display text-2xl font-black text-ink">این صفحه پیدا نشد</h1>
      <p className="mt-2 max-w-sm text-ink-muted">شاید آدرس را اشتباه وارد کرده‌ای یا این صفحه دیگر وجود ندارد.</p>
      <div className="mt-6 flex gap-3">
        <Link href="/"><Button><Home size={16} /> بازگشت به خانه</Button></Link>
        <Link href="/products"><Button variant="ghost"><Search size={16} /> کاوش محصولات</Button></Link>
      </div>
    </Container>
  );
}
