import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type WaitlistPayload = {
  email?: string;
  source?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let payload: WaitlistPayload;

  try {
    payload = (await request.json()) as WaitlistPayload;
  } catch {
    return NextResponse.json(
      { message: "Invalid request body." },
      { status: 400 },
    );
  }

  const email = payload.email?.trim().toLowerCase();
  const source = payload.source?.trim() || "landing-page";

  if (!email || !emailPattern.test(email)) {
    return NextResponse.json(
      { message: "Enter a valid email address." },
      { status: 400 },
    );
  }

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("waitlist_signups").insert({
      email,
      source,
    });

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { message: "You’re already on the waitlist with this email." },
          { status: 409 },
        );
      }

      console.error("waitlist insert failed", error);

      return NextResponse.json(
        { message: "Could not save your signup right now." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { message: "You’re on the list. Watch your inbox for launch updates." },
      { status: 201 },
    );
  } catch (error) {
    console.error("waitlist route setup failed", error);

    return NextResponse.json(
      { message: "Server setup is incomplete. Add the Supabase env vars." },
      { status: 500 },
    );
  }
}
