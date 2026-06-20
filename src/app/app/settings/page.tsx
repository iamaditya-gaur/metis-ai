import { AppShell } from "@/components/app-shell";
import { GlassPanel } from "@/components/glass-panel";
import { ProfileForm } from "./profile-form";
import { PasswordForm } from "./password-form";
import { SignOutButton } from "./sign-out-button";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
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

  return (
    <AppShell
      eyebrow="Settings"
      title="Your account"
      description="Manage how you sign in and what name shows up in your saved data."
    >
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
