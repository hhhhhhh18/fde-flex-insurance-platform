"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/states/error-state";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface the digest in the browser console only; the UI shows a safe message.
    console.error("Dashboard error", error.digest ?? error.message);
  }, [error]);

  return (
    <ErrorState
      title="Something went wrong while loading this view"
      description="The page could not be rendered. Retry, or check the server logs if the problem persists."
      detail={error.digest ? `Digest ${error.digest}` : undefined}
      action={<Button onClick={reset}>Retry</Button>}
    />
  );
}
