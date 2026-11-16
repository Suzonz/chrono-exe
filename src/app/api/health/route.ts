import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Lets the extension discover which local port runs CHRONO.EXE. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ app: "CHRONO.EXE", ok: true });
}
