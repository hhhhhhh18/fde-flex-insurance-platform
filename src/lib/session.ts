import { cookies } from "next/headers";
import type { Role } from "@/lib/authz";
import { ROLES } from "@/lib/authz";

export const ROLE_COOKIE = "ilab_role";

/**
 * Demo identity: the acting role is stored in an httpOnly cookie.
 * This is NOT authentication. Every server action still authorizes using this
 * role, and the README documents the gap explicitly.
 */
export async function getActingRole(): Promise<Role> {
  const store = await cookies();
  const raw = store.get(ROLE_COOKIE)?.value;
  return (ROLES as string[]).includes(raw ?? "") ? (raw as Role) : "APPLICANT";
}

export function actorIdFor(role: Role): string {
  switch (role) {
    case "APPLICANT":
      return "applicant-demo";
    case "OPERATIONS_ANALYST":
      return "analyst-demo";
    case "RISK_REVIEWER":
      return "reviewer-demo";
    case "ADMIN":
      return "admin-demo";
  }
}
