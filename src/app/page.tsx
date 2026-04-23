import { FeatureSections } from "@/components/feature-sections";
import { FinalCta } from "@/components/final-cta";
import { Hero } from "@/components/hero";

export default function Home() {
  return (
    <main className="page-shell">
      <div className="page-noise" aria-hidden="true" />
      <Hero />
      <FeatureSections />
      <FinalCta />
    </main>
  );
}
