import { NextResponse } from "next/server";

import { runReportingWorkflow } from "@/lib/metis/reporting";
import type { ReportingRunRequest } from "@/lib/metis/types";

export async function POST(request: Request) {
  let payload: ReportingRunRequest;

  try {
    payload = (await request.json()) as ReportingRunRequest;
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  try {
    const result = await runReportingWorkflow(payload);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Reporting run failed.",
      },
      { status: 500 },
    );
  }
}
