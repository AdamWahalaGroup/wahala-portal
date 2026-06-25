import { NextResponse } from "next/server";

// TODO (Phase 1): lightweight session-cookie presence check here, then do the
// real authorization in route handlers (the scoped-query layer), NOT in middleware.
//
// OpenNext caveat: Node.js-runtime middleware is not yet supported — keep this
// file edge-compatible (no Node APIs). Heavy auth logic belongs in route handlers.
// Empty matcher = this currently runs nowhere.
export function middleware() {
  return NextResponse.next();
}

export const config = { matcher: [] as string[] };
