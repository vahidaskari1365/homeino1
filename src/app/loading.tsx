import { Container } from "@/components/shared";
import { Skeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <Container className="py-8 sm:py-10" aria-label="در حال بارگذاری صفحه">
      <div className="mb-8 space-y-3"><Skeleton className="h-3 w-24" /><Skeleton className="h-10 w-full max-w-md" /><Skeleton className="h-4 w-full max-w-xl" /></div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => <div key={index} className="card-surface overflow-hidden"><Skeleton className="aspect-[4/5] w-full rounded-none" /><div className="space-y-2 p-3"><Skeleton className="h-3 w-2/5" /><Skeleton className="h-4 w-4/5" /><Skeleton className="h-10 w-full" /></div></div>)}
      </div>
    </Container>
  );
}
