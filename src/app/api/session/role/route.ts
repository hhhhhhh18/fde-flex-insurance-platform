import { NextResponse } from "next/server";
import { getActingRole, ROLE_COOKIE } from "@/lib/session";
import { ROLE_PERMISSIONS, AUTHORITY_LIMITS } from "@/lib/authz";
import { fail, ok, parseBody, route } from "@/lib/api/http";
import { roleSchema } from "@/lib/validation/schemas";

/**
 * Demo identity switch. This is NOT authentication.
 *
 * Set DEMO_AUTH=false in any real deployment to disable role switching; the app
 * then falls back to the least-privileged APPLICANT role until real
 * authentication is wired in (see docs/security.md).
 */
const demoAuthEnabled = () => process.env.DEMO_AUTH !== "false";

export const GET = route(async () => {
  const role = await getActingRole();
  return ok({
    role,
    permissions: ROLE_PERMISSIONS[role],
    authorityLimit: AUTHORITY_LIMITS[role],
    demoMode: demoAuthEnabled(),
  });
});

export const POST = route(async (req) => {
  if (!demoAuthEnabled()) {
    return NextResponse.json(
      { error: { code: "DEMO_AUTH_DISABLED", message: "Role switching is disabled. Configure real authentication." } },
      { status: 403 },
    );
  }

  const { role } = await parseBody(req, roleSchema);
  const response = NextResponse.json(
    { role, permissions: ROLE_PERMISSIONS[role], authorityLimit: AUTHORITY_LIMITS[role], demoMode: true },
    { status: 200 },
  );
  response.cookies.set({
    name: ROLE_COOKIE,
    value: role,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8,
  });
  return response;
});
