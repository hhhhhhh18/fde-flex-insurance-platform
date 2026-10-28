import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ListLoading({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-3 w-96" />
      </div>

      <Skeleton className="h-[86px] w-full rounded-[var(--radius-card)]" />

      <Card className="overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="flex items-center gap-4 px-5 py-3.5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-40" />
              <Skeleton className="ml-auto h-3 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
