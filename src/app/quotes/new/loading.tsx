import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-64" />
      <Card className="p-5">
        <Skeleton className="h-4 w-32" />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
        <Skeleton className="mt-4 h-40 w-full" />
      </Card>
    </div>
  );
}
