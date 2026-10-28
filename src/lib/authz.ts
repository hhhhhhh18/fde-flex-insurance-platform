import { dec, type Numeric } from "@/lib/money";

/**
 * Role-based authorization used by every mutating service and route handler.
 *
 * IMPORTANT: the role comes from a cookie (see src/lib/session.ts). That is a
 * demo identity mechanism, NOT authentication - see docs/security.md and the
 * README "Known limitations". The permission checks below still run on the
 * server for every mutation, so the UI cannot bypass them.
 */
export type Role = "APPLICANT" | "OPERATIONS_ANALYST" | "RISK_REVIEWER" | "ADMIN";

export const ROLES: Role[] = ["APPLICANT", "OPERATIONS_ANALYST", "RISK_REVIEWER", "ADMIN"];

export type Permission =
  | "quote:evaluate"
  | "quote:read"
  | "policy:issue"
  | "policy:cancel"
  | "endorsement:submit"
  | "endorsement:decide"
  | "renewal:generate"
  | "renewal:respond"
  | "underwriting:decide"
  | "validation:run"
  | "data:generate"
  | "export:read";

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  APPLICANT: ["quote:evaluate", "quote:read", "export:read"],
  OPERATIONS_ANALYST: [
    "quote:evaluate",
    "quote:read",
    "policy:issue",
    "policy:cancel",
    "endorsement:submit",
    "endorsement:decide",
    "renewal:generate",
    "renewal:respond",
    "validation:run",
    "export:read",
  ],
  RISK_REVIEWER: [
    "quote:evaluate",
    "quote:read",
    "endorsement:decide",
    "underwriting:decide",
    "validation:run",
    "export:read",
  ],
  ADMIN: [
    "quote:evaluate",
    "quote:read",
    "policy:issue",
    "policy:cancel",
    "endorsement:submit",
    "endorsement:decide",
    "renewal:generate",
    "renewal:respond",
    "underwriting:decide",
    "validation:run",
    "data:generate",
    "export:read",
  ],
};

/** Maximum gross premium each role may bind or approve without escalation. */
export const AUTHORITY_LIMITS: Record<Role, string> = {
  APPLICANT: "0.00",
  OPERATIONS_ANALYST: "25000.00",
  RISK_REVIEWER: "250000.00",
  ADMIN: "1000000.00",
};

export class AuthorizationError extends Error {
  readonly code = "FORBIDDEN";
  constructor(
    message: string,
    readonly requiredPermission?: Permission,
    readonly requiredAuthority?: string,
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function authorityLimit(role: Role) {
  return dec(AUTHORITY_LIMITS[role]);
}

export function assertAuthorized(role: Role, permission: Permission): void {
  if (!can(role, permission)) {
    throw new AuthorizationError(
      `Role ${role} is not permitted to perform ${permission}.`,
      permission,
    );
  }
}

/**
 * Enforces that the actor's monetary authority covers the amount.
 * Returns a structured reason instead of throwing when used for decisioning.
 */
export function checkAuthority(role: Role, amount: Numeric): { allowed: boolean; reason?: string } {
  const limit = authorityLimit(role);
  if (dec(amount).gt(limit)) {
    return {
      allowed: false,
      reason: `Amount ${dec(amount).toFixed(2)} exceeds the ${role} authority limit of ${limit.toFixed(2)}.`,
    };
  }
  return { allowed: true };
}
