import { NextResponse } from "next/server";

import { getSetupReadiness } from "@/lib/metis/env";

export async function GET() {
  const readiness = await getSetupReadiness();
  return NextResponse.json(readiness);
}
