import { NextResponse } from "next/server";

import { getRunDetail } from "@/lib/metis/runs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const { runId } = await context.params;
  const run = await getRunDetail(runId);

  if (!run) {
    return NextResponse.json({ message: "Run not found." }, { status: 404 });
  }

  return NextResponse.json({ run });
}
