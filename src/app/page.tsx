import { FeatureSections } from "@/components/feature-sections";
import { FinalCta } from "@/components/final-cta";
import { Hero } from "@/components/hero";
import { LandingNav } from "@/components/landing-nav";
import { createClient } from "@/lib/supabase/server";

// Read the signed-in user from cookies so the nav CTA is correct on first
// paint — no auth/no-auth flash for return visitors.
export const dynamic = "force-dynamic";

export default async function Home() {
  let userEmail: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userEmail = user?.email ?? null;
  } catch {
    // If Supabase envs are missing at request time the landing still renders
    // as the signed-out experience — better than a 500.
  }

  return (
    <main className="page-shell">
      <div className="page-noise" aria-hidden="true" />
      <LandingNav user={userEmail !== null ? { email: userEmail } : null} />
      <Hero />
      <FeatureSections />
      <FinalCta />
    </main>
  );
}
