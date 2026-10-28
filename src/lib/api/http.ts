import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { AppError } from "@/lib/errors";
import { AuthorizationError } from "@/lib/authz";
import { LifecycleError } from "@/lib/lifecycle/state-machine";
import { getActingRole, actorIdFor } from "@/lib/session";
import type { Actor } from "@/services/quote-service";

const MAX_BODY_BYTES = 64 * 1024;

export async function currentActor(): Promise<Actor> {
  const role = await getActingRole();
  return { role, actorId: actorIdFor(role) };
}

export function ok(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Next.js signals dynamic rendering by throwing special errors during
 * prerendering. Those must propagate untouched, otherwise the framework would
 * treat a bailout as a 500 response.
 */
function isFrameworkSignal(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  if (typeof digest === "string" && (digest.startsWith("NEXT_") || digest === "DYNAMIC_SERVER_USAGE")) return true;
  const name = (error as { name?: unknown } | null)?.name;
  if (name === "DynamicServerError" || name === "IncompletePostponeError" || name === "PostponeError") return true;
  // cookies()/headers() reject with this message when a prerender completes early.
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" && /during prerendering|bail out of prerendering|dynamic server usage/i.test(message);
}

/** Maps domain errors to HTTP without leaking stack traces or driver messages. */
export function fail(error: unknown): NextResponse {
  if (isFrameworkSignal(error)) throw error;

  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details ?? null } },
      { status: error.status },
    );
  }
  if (error instanceof AuthorizationError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          requiredPermission: error.requiredPermission ?? null,
        },
      },
      { status: 403 },
    );
  }
  if (error instanceof LifecycleError) {
    return NextResponse.json(
      { error: { code: "INVALID_TRANSITION", message: error.message, details: { machine: error.machine, from: error.from, to: error.to } } },
      { status: 409 },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed.",
          details: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
        },
      },
      { status: 422 },
    );
  }
  console.error("[api] unhandled error", error instanceof Error ? error.message : error);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } },
    { status: 500 },
  );
}

export function route<Ctx>(handler: (req: NextRequest, ctx: Ctx) => Promise<Response>) {
  return async (req: NextRequest, ctx: Ctx): Promise<Response> => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      return fail(error);
    }
  };
}

export async function parseBody<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) {
    throw new AppError(413, "PAYLOAD_TOO_LARGE", `Request body exceeds ${MAX_BODY_BYTES} bytes.`);
  }
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    throw new AppError(413, "PAYLOAD_TOO_LARGE", `Request body exceeds ${MAX_BODY_BYTES} bytes.`);
  }
  let json: unknown;
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    throw new AppError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
  return schema.parse(json);
}

export function parseQuery<T>(req: NextRequest, schema: ZodType<T>): T {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  return schema.parse(params);
}
