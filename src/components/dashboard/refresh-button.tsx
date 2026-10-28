"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [spinning, setSpinning] = useState(false);

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending || spinning}
      onClick={() => {
        setSpinning(true);
        startTransition(() => {
          router.refresh();
          setTimeout(() => setSpinning(false), 600);
        });
      }}
    >
      <RefreshCw aria-hidden className={spinning || pending ? "animate-spin" : undefined} />
      {pending ? "Refreshing…" : "Refresh"}
    </Button>
  );
}
