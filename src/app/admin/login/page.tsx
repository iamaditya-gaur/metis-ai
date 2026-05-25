import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import {
  ADMIN_COOKIE_NAME,
  isAdminConfigured,
  issueAdminCookieValue,
  verifyAdminPassword,
} from "@/lib/auth/admin-gate";

type LoginPageProps = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

async function loginAction(formData: FormData): Promise<void> {
  "use server";

  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin/runs");

  if (!isAdminConfigured()) {
    redirect("/admin/login?error=server-not-configured");
  }

  if (!verifyAdminPassword(password)) {
    redirect(`/admin/login?error=invalid&next=${encodeURIComponent(next)}`);
  }

  const issued = issueAdminCookieValue();
  if (!issued) {
    redirect("/admin/login?error=server-not-configured");
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, issued.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: issued.maxAge,
    path: "/",
  });

  redirect(next);
}

export default async function AdminLoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = params.next ?? "/admin/runs";
  const error = params.error;

  const errorMessage =
    error === "invalid"
      ? "Wrong password."
      : error === "server-not-configured"
        ? "Admin auth env vars not set on this deployment."
        : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="rounded-2xl border border-white/10 bg-zinc-950 p-8 shadow-xl">
        <h1 className="text-xl font-semibold text-white">Admin sign in</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Required to view observability traces.
        </p>

        <form action={loginAction} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next} />

          <label className="block text-sm font-medium text-zinc-300">
            <span>Password</span>
            <input
              type="password"
              name="password"
              autoFocus
              required
              className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-white/30 focus:outline-none"
              placeholder="Enter admin password"
            />
          </label>

          {errorMessage ? (
            <p className="text-sm text-red-400">{errorMessage}</p>
          ) : null}

          <button
            type="submit"
            className="w-full rounded-lg bg-white px-3 py-2 text-sm font-semibold text-black hover:bg-zinc-200"
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
