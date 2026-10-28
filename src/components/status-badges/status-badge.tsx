import { Badge, type BadgeProps } from "@/components/ui/badge";
import { humanize } from "@/lib/format";

type Tone = NonNullable<BadgeProps["variant"]>;

const DECISION_TONES: Record<string, Tone> = {
  ELIGIBLE: "success",
  REFERRED: "warning",
  INELIGIBLE: "danger",
  AWAITING_INFORMATION: "info",
  AWAITING_INFROMATION: "info",
};

const POLICY_TONES: Record<string, Tone> = {
  ACTIVE: "success",
  PENDING_PAYMENT: "warning",
  CANCELLED: "danger",
  EXPIRED: "neutral",
};

const RENEWAL_TONES: Record<string, Tone> = {
  OFFERED: "info",
  ACCEPTED: "success",
  DECLINED: "danger",
  EXPIRED: "neutral",
};

const UW_TONES: Record<string, Tone> = {
  PENDING: "warning",
  APPROVED: "success",
  DECLINED: "danger",
  INFORMATION_REQUESTED: "info",
};

const ENDORSEMENT_TONES: Record<string, Tone> = {
  PENDING: "warning",
  APPROVED: "success",
  APPLIED: "success",
  REJECTED: "danger",
};

const SEVERITY_TONES: Record<string, Tone> = {
  CRITICAL: "danger",
  HIGH: "danger",
  MEDIUM: "warning",
  LOW: "info",
  INFO: "neutral",
};

export type StatusKind = "decision" | "policy" | "renewal" | "underwriting" | "endorsement" | "severity";

const TONE_MAPS: Record<StatusKind, Record<string, Tone>> = {
  decision: DECISION_TONES,
  policy: POLICY_TONES,
  renewal: RENEWAL_TONES,
  underwriting: UW_TONES,
  endorsement: ENDORSEMENT_TONES,
  severity: SEVERITY_TONES,
};

export function StatusBadge({ value, kind }: { value: string; kind: StatusKind }) {
  const tone = TONE_MAPS[kind][value] ?? "neutral";
  return <Badge variant={tone}>{humanize(value)}</Badge>;
}
