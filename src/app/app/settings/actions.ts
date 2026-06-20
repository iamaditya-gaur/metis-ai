"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { AuthFormState } from "@/app/(auth)/actions";

export async function updateProfileAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const raw = formData.get("full_name");
  if (typeof raw !== "string") {
    return { status: "error", message: "Invalid request." };
  }
  const fullName = raw.trim();
  if (fullName.length < 1 || fullName.length > 120) {
    return {
      status: "error",
      message: "Name must be between 1 and 120 characters.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: "error", message: "Sign in to update your profile." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    return { status: "error", message: `Couldn't save: ${error.message}` };
  }

  revalidatePath("/app/settings");
  return { status: "success", message: "Name updated." };
}

export async function updatePasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const raw = formData.get("new_password");
  if (typeof raw !== "string") {
    return { status: "error", message: "Invalid request." };
  }
  const password = raw.trim();
  if (password.length < 8) {
    return {
      status: "error",
      message: "New password must be at least 8 characters.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { status: "error", message: error.message };
  }
  return { status: "success", message: "Password updated." };
}
