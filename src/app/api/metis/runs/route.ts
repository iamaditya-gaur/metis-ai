import { NextResponse } from "next/server";

import { listRunSummaries } from "@/lib/metis/runs";

export async function GET() {
  const runs = await listRunSummaries();
  return NextResponse.json({ runs });
}
