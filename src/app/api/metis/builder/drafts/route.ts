import { NextResponse } from "next/server";

import { createBuilderDrafts } from "@/lib/metis/builder";
import type { BuilderDraftCreateRequest } from "@/lib/metis/types";

export async function POST(request: Request) {
  let payload: BuilderDraftCreateRequest;

  try {
    payload = (await request.json()) as BuilderDraftCreateRequest;
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  try {
    const result = await createBuilderDrafts(payload);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Draft creation failed.",
      },
      { status: 500 },
    );
  }
}
