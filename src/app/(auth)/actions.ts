"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

function resolveOrigin(): string | undefined {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return undefined;
}

function friendlySignInError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login")) return "Email or password is incorrect.";
  if (lower.includes("email not confirmed"))
    return "Confirm your email first, then sign in.";
  return "Email or password is incorrect.";
}

function friendlySignUpError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("already") || lower.includes("registered"))
    return "That email already has an account. Try signing in instead.";
  if (lower.includes("weak") || lower.includes("short"))
    return "Pick a stronger password (8+ characters).";
  if (lower.includes("invalid") && lower.includes("email"))
    return "That email address doesn't look right.";
  if (lower.includes("rate") || lower.includes("too many"))
    return "Too many signup attempts. Wait a minute and try again.";
  return `Signup failed: ${message}`;
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
    return { status: "error", message: friendlySignInError(error.message) };
  }
  const next = safeNext(formData.get("next"));
  revalidatePath("/", "layout");
  redirect(next);
}

/**
 * Creates the user with admin privileges and `email_confirm: true` so they
 * skip the email-verification step, then signs them in on the same submit.
 * No SMTP needed; the user lands inside /app immediately.
 *
 * If admin createUser fails (e.g. user already exists) we surface a friendly
 * message and don't proceed to sign in.
 */
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

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      status: "error",
      message: "Server isn't configured for signup yet. Try again in a minute.",
    };
  }

  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) {
    return { status: "error", message: friendlySignUpError(createError.message) };
  }

  // Sign the user in on the same request so the session cookie is set and
  // they land inside /app immediately.
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) {
    return {
      status: "error",
      message:
        "Account was created but auto sign-in failed. Try signing in manually.",
    };
  }

  const next = safeNext(formData.get("next"));
  revalidatePath("/", "layout");
  redirect(next);
}

export async function resetPasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = readEmail(formData);
  if (!email) return { status: "error", message: "Enter a valid email." };

  const supabase = await createClient();
  const origin = resolveOrigin();
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
