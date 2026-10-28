"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/status-badges/status-badge";

type Outcome = "APPROVED" | "DECLINED" | "INFORMATION_REQUESTED";

const OUTCOME_LABELS: Record<Outcome, string> = {
  APPROVED: "Approve referral",
  DECLINED: "Decline referral",
  INFORMATION_REQUESTED: "Request more information",
};

export function DecisionPanel({
  decisionId,
  reference,
  canDecide,
}: {
  decisionId: string;
  reference: string;
  canDecide: boolean;
}) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<Outcome>("APPROVED");
  const [notes, setNotes] = useState("");
  const [requestedInfo, setRequestedInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ message: string; detail?: string } | null>(null);
  const [success, setSuccess] = useState<{ status: string; reference: string } | null>(null);

  async function submit() {
    setError(null);
    setSuccess(null);
    if (notes.trim().length < 5) {
      setError({ message: "Reviewer notes are required", detail: "Provide at least 5 characters explaining the decision." });
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/underwriting/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decisionId,
          outcome,
          notes: notes.trim(),
          requestedInfo: outcome === "INFORMATION_REQUESTED" ? requestedInfo.trim() || undefined : undefined,
        }),
      });
      const text = await response.text();
      const body = text ? (JSON.parse(text) as { decision?: { status: string; reference: string }; error?: { message: string; details?: unknown } }) : {};

      if (response.status === 403) {
        setError({
          message: "Not permitted",
          detail: body.error?.message ?? "Your role cannot decide referrals, or the premium exceeds your authority.",
        });
        return;
      }
      if (response.status === 409) {
        setError({ message: "This case cannot be decided", detail: body.error?.message ?? "The referral is no longer pending." });
        return;
      }
      if (!response.ok) {
        setError({ message: `Decision failed (HTTP ${response.status})`, detail: body.error?.message });
        return;
      }
      setSuccess({ status: body.decision?.status ?? outcome, reference: body.decision?.reference ?? reference });
      setNotes("");
      setRequestedInfo("");
      router.refresh();
    } catch {
      setError({ message: "The decision could not be submitted", detail: "Check your connection and try again." });
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <Alert tone="success" title={`Decision recorded: ${success.reference}`}>
        <div className="flex items-center gap-2">
          Status is now
          <StatusBadge value={success.status} kind="underwriting" />
        </div>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      {!canDecide ? (
        <Alert tone="info" title="Read-only view">
          Your role cannot decide referrals. Switch to Risk reviewer or Admin to action this case.
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`outcome-${decisionId}`}>Outcome</Label>
          <Select
            id={`outcome-${decisionId}`}
            value={outcome}
            onChange={(event) => setOutcome(event.target.value as Outcome)}
            disabled={!canDecide}
          >
            {(Object.keys(OUTCOME_LABELS) as Outcome[]).map((value) => (
              <option key={value} value={value}>
                {OUTCOME_LABELS[value]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`notes-${decisionId}`}>Reviewer notes</Label>
          <Textarea
            id={`notes-${decisionId}`}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Reason for the decision (recorded in the audit trail)"
            className="min-h-10"
            disabled={!canDecide}
          />
        </div>
      </div>

      {outcome === "INFORMATION_REQUESTED" ? (
        <div className="space-y-1.5">
          <Label htmlFor={`info-${decisionId}`}>Information requested</Label>
          <Textarea
            id={`info-${decisionId}`}
            value={requestedInfo}
            onChange={(event) => setRequestedInfo(event.target.value)}
            placeholder="What must the applicant supply?"
            className="min-h-10"
            disabled={!canDecide}
          />
        </div>
      ) : null}

      {error ? (
        <Alert tone="danger" title={error.message}>
          {error.detail}
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void submit()} disabled={!canDecide || submitting} size="sm">
          {submitting ? <Loader2 aria-hidden className="animate-spin" /> : outcome === "APPROVED" ? <CheckCircle2 aria-hidden /> : outcome === "DECLINED" ? <XCircle aria-hidden /> : null}
          {submitting ? "Submitting…" : "Record decision"}
        </Button>
        <span className="text-[11px] text-muted">
          Decisions are authorized server-side against your role and monetary authority.
        </span>
      </div>
    </div>
  );
}
