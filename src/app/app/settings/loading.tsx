import { AppTopbar } from "@/components/app-topbar";
import { SkeletonPanel } from "@/components/skeleton";

export default function Loading() {
  return (
    <>
      <AppTopbar
        eyebrow="Settings"
        title="Your account"
        description="Manage how you sign in and what name shows up in your saved data."
      />
      <main className="product-content">
        <div className="settings-grid">
          <SkeletonPanel rows={3} />
          <SkeletonPanel rows={3} />
          <SkeletonPanel rows={1} />
        </div>
      </main>
    </>
  );
}
