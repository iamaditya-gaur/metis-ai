import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import {
  createToneSource,
  deleteToneSource,
  listToneSources,
  touchToneSource,
} from "@/lib/tone-sources/queries";

export const dynamic = "force-dynamic";

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await getUser();
  if (!user) {
    return NextResponse.json({ message: "Not signed in." }, { status: 401 });
  }
  try {
    const sources = await listToneSources(supabase);
    return NextResponse.json({ sources });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not load tone sources." },
      { status: 500 },
    );
  }
}

type CreateBody = {
  label?: string;
  content?: string;
  touchId?: string;
};

export async function POST(request: Request) {
  const { supabase, user } = await getUser();
  if (!user) {
    return NextResponse.json({ message: "Not signed in." }, { status: 401 });
  }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  // Path A: bump last_used_at on an existing preset.
  if (body.touchId) {
    try {
      await touchToneSource(supabase, body.touchId);
      return NextResponse.json({ ok: true });
    } catch (error) {
      return NextResponse.json(
        { message: error instanceof Error ? error.message : "Could not update tone source." },
        { status: 500 },
      );
    }
  }

  // Path B: create a new tone source.
  const label = body.label?.trim() ?? "";
  const content = body.content?.trim() ?? "";
  if (!label || !content) {
    return NextResponse.json(
      { message: "label and content are both required." },
      { status: 400 },
    );
  }

  try {
    const source = await createToneSource(supabase, user.id, { label, content });
    return NextResponse.json({ source });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not save tone source." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const { supabase, user } = await getUser();
  if (!user) {
    return NextResponse.json({ message: "Not signed in." }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ message: "Missing id." }, { status: 400 });
  }

  try {
    await deleteToneSource(supabase, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Could not delete tone source." },
      { status: 500 },
    );
  }
}
