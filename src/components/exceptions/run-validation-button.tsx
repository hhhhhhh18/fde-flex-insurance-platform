"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RunValidationButton({ canRun }: { canRun: boolean }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const response = await fetch("/api/validation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetLabel: "operational", persist: true }),
      });
      if (response.status === 403) {
        setError("Your role cannot run validation. Switch to Operations analyst, Risk reviewer or Admin.");
        return;
      }
      if (!response.ok) {
        setError(`Validation failed (HTTP ${response.status}).`);
        return;
      }
      router.refresh();
    } catch {
      setError("The validation run could not be started.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" onClick={() => void run()} disabled={!canRun || running}>
        {running ? <Loader2 aria-hidden className="animate-spin" /> : <PlayCircle aria-hidden />}
        {running ? "Running…" : "Run validation"}
      </Button>
      {error ? (
        <p role="alert" className="max-w-xs text-right text-[11px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
