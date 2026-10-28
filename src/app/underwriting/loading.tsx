import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-64" />
      <Skeleton className="h-3 w-96" />
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={index} className="p-5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-2 h-3 w-72" />
          <Skeleton className="mt-4 h-16 w-full" />
        </Card>
      ))}
    </div>
  );
}
