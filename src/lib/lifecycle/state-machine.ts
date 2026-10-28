/**
 * Explicit lifecycle state machines. Services call assertTransition before any
 * status write, so an invalid transition fails with a typed error instead of
 * silently corrupting history.
 */

export type MachineName = "quote" | "policy" | "endorsement" | "renewal" | "underwriting";

export const TRANSITIONS: Record<MachineName, Record<string, string[]>> = {
  quote: {
    DRAFT: ["EVALUATED"],
    EVALUATED: ["ACCEPTED", "EXPIRED", "SUPERSEDED"],
    ACCEPTED: [],
    EXPIRED: [],
    SUPERSEDED: [],
  },
  policy: {
    PENDING_PAYMENT: ["ACTIVE", "CANCELLED"],
    ACTIVE: ["CANCELLED", "EXPIRED"],
    CANCELLED: [],
    EXPIRED: [],
  },
  endorsement: {
    PENDING: ["APPROVED", "REJECTED"],
    APPROVED: ["APPLIED"],
    APPLIED: [],
    REJECTED: [],
  },
  renewal: {
    OFFERED: ["ACCEPTED", "DECLINED", "EXPIRED"],
    ACCEPTED: [],
    DECLINED: [],
    EXPIRED: [],
  },
  underwriting: {
    PENDING: ["APPROVED", "DECLINED", "INFORMATION_REQUESTED"],
    INFORMATION_REQUESTED: ["APPROVED", "DECLINED"],
    APPROVED: [],
    DECLINED: [],
  },
};

export class LifecycleError extends Error {
  readonly code = "INVALID_TRANSITION";
  constructor(
    readonly machine: MachineName,
    readonly from: string,
    readonly to: string,
  ) {
    super(`Invalid ${machine} transition: ${from} -> ${to}`);
    this.name = "LifecycleError";
  }
}

export function canTransition(machine: MachineName, from: string, to: string): boolean {
  return (TRANSITIONS[machine][from] ?? []).includes(to);
}

export function assertTransition(machine: MachineName, from: string, to: string): void {
  if (!canTransition(machine, from, to)) throw new LifecycleError(machine, from, to);
}

export function allowedNextStates(machine: MachineName, from: string): string[] {
  return TRANSITIONS[machine][from] ?? [];
}

export function isTerminal(machine: MachineName, state: string): boolean {
  return allowedNextStates(machine, state).length === 0;
}

/** Policy states that may be endorsed or renewed. */
export function isEndorsable(status: string): boolean {
  return status === "ACTIVE";
}

/** Only an active or expired policy can produce a renewal offer - never a cancelled one. */
export function isRenewable(status: string): boolean {
  return status === "ACTIVE" || status === "EXPIRED";
}
