import { AppTopbar } from "@/components/app-topbar";
import { SkeletonPanel } from "@/components/skeleton";

export default function Loading() {
  return (
    <>
      <AppTopbar
        eyebrow="Reports"
        title="Generate a Meta ads summary that sounds like you"
        description="Pick a saved connection, set the reporting window, drop in past client messages, and Metis returns the factual read plus a send-ready client update."
      />
      <main className="product-content">
        <div className="product-skeleton-stack">
          <SkeletonPanel rows={2} />
          <SkeletonPanel rows={5} />
        </div>
      </main>
    </>
  );
}
