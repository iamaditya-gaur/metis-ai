import { AppTopbar } from "@/components/app-topbar";
import { SkeletonPanel } from "@/components/skeleton";

export default function Loading() {
  return (
    <>
      <AppTopbar
        eyebrow="Connections"
        title="Your Meta connections"
        description="Tokens stay encrypted and never appear in any output. Add one per ad account or agency client."
      />
      <main className="product-content">
        <div className="connections-surface">
          <SkeletonPanel rows={2} />
          <SkeletonPanel rows={3} />
        </div>
      </main>
    </>
  );
}
