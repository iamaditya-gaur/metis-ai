import { NextResponse } from "next/server";

import { runBuilderPreview } from "@/lib/metis/builder";
import type { BuilderPreviewRequest } from "@/lib/metis/types";

export async function POST(request: Request) {
  let payload: BuilderPreviewRequest;

  try {
    payload = (await request.json()) as BuilderPreviewRequest;
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  try {
    const result = await runBuilderPreview(payload);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Builder preview failed.",
      },
      { status: 500 },
    );
  }
}
