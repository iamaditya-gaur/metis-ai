"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type AuthFormState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readEmail(formData: FormData): string | null {
  const raw = formData.get("email");
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  return EMAIL_RE.test(email) ? email : null;
}

function readPassword(formData: FormData, field = "password"): string | null {
  const raw = formData.get(field);
  if (typeof raw !== "string") return null;
  const pw = raw.trim();
  return pw.length >= 8 ? pw : null;
}

function safeNext(input: FormDataEntryValue | null): string {
  if (typeof input !== "string") return "/app/reports";
  if (!input.startsWith("/") || input.startsWith("//")) return "/app/reports";
  return input;
}

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = readEmail(formData);
  const password = readPassword(formData);
  if (!email) return { status: "error", message: "Enter a valid email." };
  if (!password)
    return {
      status: "error",
      message: "Password must be at least 8 characters.",
    };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { status: "error", message: "Email or password is incorrect." };
  }
  const next = safeNext(formData.get("next"));
  revalidatePath("/", "layout");
  redirect(next);
}

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = readEmail(formData);
  const password = readPassword(formData);
  if (!email) return { status: "error", message: "Enter a valid email." };
  if (!password)
    return {
      status: "error",
      message: "Pick a password with at least 8 characters.",
    };

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.trim() || undefined;
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: origin
        ? `${origin}/auth/callback`
        : undefined,
    },
  });
  if (error) {
    if (error.message.toLowerCase().includes("already")) {
      return {
        status: "error",
        message: "That email already has an account. Try signing in.",
      };
    }
    return { status: "error", message: error.message };
  }

  return {
    status: "success",
    message:
      "Account created. Check your inbox to confirm your email, then sign in.",
  };
}

export async function resetPasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = readEmail(formData);
  if (!email) return { status: "error", message: "Enter a valid email." };

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.trim() || undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: origin ? `${origin}/reset-password/update` : undefined,
  });
  if (error) {
    return { status: "error", message: error.message };
  }
  return {
    status: "success",
    message:
      "If that email has an account, a reset link is on its way. Check your inbox.",
  };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
