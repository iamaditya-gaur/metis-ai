import { AppTopbar } from "@/components/app-topbar";
import { SkeletonPanel } from "@/components/skeleton";

export default function Loading() {
  return (
    <>
      <AppTopbar
        eyebrow="History"
        title="Your saved reports"
        description="Every Metis run you've kicked off, with the latest first."
      />
      <main className="product-content">
        <div className="product-skeleton-stack">
          <SkeletonPanel rows={1} rowHeight="3rem" withHeader={false} />
          <SkeletonPanel rows={1} rowHeight="3rem" withHeader={false} />
          <SkeletonPanel rows={1} rowHeight="3rem" withHeader={false} />
          <SkeletonPanel rows={1} rowHeight="3rem" withHeader={false} />
          <SkeletonPanel rows={1} rowHeight="3rem" withHeader={false} />
        </div>
      </main>
    </>
  );
}
