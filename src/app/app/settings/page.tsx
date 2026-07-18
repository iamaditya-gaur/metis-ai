import { AppShell } from "@/components/app-shell";
import { GlassPanel } from "@/components/glass-panel";
import { LlmKeyCard } from "@/components/llm-key-card";
import { ProfileForm } from "./profile-form";
import { PasswordForm } from "./password-form";
import { SignOutButton } from "./sign-out-button";
import { getLlmKeySummary } from "@/lib/llm-keys/store";
import { createClient } from "@/lib/supabase/server";

const LLM_ERROR_COPY: Record<string, string> = {
  flow_expired: "The connect flow expired — try again.",
  exchange_failed: "OpenRouter didn't complete the handoff — try again.",
  save_failed: "Connected but saving failed — try again.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let fullName = "";
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    fullName = data?.full_name ?? "";
  }

  const llmKeySummary = await getLlmKeySummary();
  const params = await searchParams;
  const savedFlash = params.llm_saved === "1";
  const errorSlug = typeof params.llm_error === "string" ? params.llm_error : null;
  const errorFlash = errorSlug ? (LLM_ERROR_COPY[errorSlug] ?? "Something went wrong — try again.") : null;

  return (
    <AppShell
      eyebrow="Settings"
      title="Your account"
      description="Manage how you sign in and what name shows up in your saved data."
    >
      <GlassPanel
        eyebrow="AI key"
        title="Bring your own AI key"
        description="Reports run on your own OpenRouter or OpenAI account. Your key is encrypted on our servers with AES-256-GCM — strong, authenticated encryption — with only its last four characters ever shown. We never log it or share it with anyone but your AI provider."
      >
        <LlmKeyCard summary={llmKeySummary} savedFlash={savedFlash} errorFlash={errorFlash} />
      </GlassPanel>

      <div className="settings-grid">
        <GlassPanel
          eyebrow="Profile"
          title="Name and email"
          description="Email is the one you signed up with. Name only shows in your own account."
        >
          <div className="product-field">
            <span className="product-label">Email</span>
            <p className="settings-readonly">{user?.email ?? "—"}</p>
          </div>
          <ProfileForm defaultFullName={fullName} />
        </GlassPanel>

        <GlassPanel
          eyebrow="Security"
          title="Password"
          description="Pick a new password any time. You stay signed in on this device after the change."
        >
          <PasswordForm />
        </GlassPanel>

        <GlassPanel
          eyebrow="Session"
          title="Sign out"
          description="Sign out of this browser. You'll need your email and password to sign back in."
        >
          <SignOutButton />
        </GlassPanel>
      </div>
    </AppShell>
  );
}
