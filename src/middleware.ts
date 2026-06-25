import { NextResponse } from "next/server";

// TODO (Phase 1): verify the Cognito session cookie here and redirect
// unauthenticated users to the Cognito Hosted UI. See src/lib/auth.ts.
// Empty matcher = this currently runs nowhere.
export function middleware() {
  return NextResponse.next();
}

export const config = { matcher: [] as string[] };
