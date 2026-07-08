import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Unauthenticated liveness probe. */
export function GET() {
  return NextResponse.json({ ok: true });
}
