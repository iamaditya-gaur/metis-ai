import { NextResponse } from "next/server";

import { getAccessibleAccounts } from "@/lib/metis/accounts";

export async function GET() {
  try {
    const accounts = await getAccessibleAccounts();
    return NextResponse.json({ accounts });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Could not load accessible Meta accounts.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let payload: { accessToken?: string };

  try {
    payload = (await request.json()) as { accessToken?: string };
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  const accessToken = payload.accessToken?.trim();

  if (!accessToken) {
    return NextResponse.json(
      { message: "A valid Meta access token is required to load ad accounts." },
      { status: 400 },
    );
  }

  try {
    const accounts = await getAccessibleAccounts({ accessToken });
    return NextResponse.json({ accounts });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Could not load accessible Meta accounts.",
      },
      { status: 500 },
    );
  }
}
