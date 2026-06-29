/**
 * Shared API-route plumbing: auth gate, error→HTTP mapping, body parsing.
 *
 * Route handlers stay thin — `requireAuth()`, call a service, return JSON, and
 * funnel every throw through `handleApiError()` so domain errors (StageError)
 * and auth/validation errors (ApiError) map to consistent status codes.
 */
import { NextResponse } from "next/server";
import { getAuthContext, type AuthContext } from "@/auth/context";
import { StageError, type StageErrorCode } from "@/domain/stage-machine";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "ApiError";
  }
}

/** Resolve the signed-in user or throw a 401. */
export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) throw new ApiError(401, "unauthorized", "Sign in required.");
  return ctx;
}

const STAGE_ERROR_STATUS: Record<StageErrorCode, number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  INVALID_STATE: 409, // wrong state for this action
  PAY_GATE: 409, // would start before payment
  CONFLICT: 409, // someone else changed the row first (CAS)
  VALIDATION: 400,
};

export function handleApiError(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.code, message: err.message }, { status: err.status });
  }
  if (err instanceof StageError) {
    return NextResponse.json(
      { error: err.code, message: err.message },
      { status: STAGE_ERROR_STATUS[err.code] },
    );
  }
  console.error("[api] unhandled error:", err);
  return NextResponse.json({ error: "internal_error" }, { status: 500 });
}

/** Best-effort JSON body parse; returns {} on empty/invalid body. */
export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}
