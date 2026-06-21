type SkeletonProps = {
  className?: string;
  /** Min-height of the skeleton block, in rem. Defaults to 1rem. */
  height?: string;
  width?: string;
};

export function Skeleton({ className, height, width }: SkeletonProps) {
  return (
    <span
      className={["product-skeleton", className].filter(Boolean).join(" ")}
      style={{
        ...(height ? { height } : null),
        ...(width ? { width } : null),
      }}
      aria-hidden="true"
    />
  );
}

type SkeletonPanelProps = {
  /** Number of fake content rows to render. Defaults to 3. */
  rows?: number;
  /** Override default height per row. */
  rowHeight?: string;
  /** Show a fake panel header (eyebrow + title). Defaults to true. */
  withHeader?: boolean;
};

/**
 * Stand-in shape for a <GlassPanel> while the real one loads. Matches the
 * panel chrome (border, padding, shimmer) so the page doesn't jump when the
 * real content arrives.
 */
export function SkeletonPanel({
  rows = 3,
  rowHeight = "1.15rem",
  withHeader = true,
}: SkeletonPanelProps) {
  return (
    <section className="glass-panel product-skeleton-panel" aria-hidden="true">
      <div className="glass-panel-content">
        {withHeader ? (
          <header className="glass-panel-head">
            <Skeleton width="6rem" height="0.7rem" />
            <Skeleton width="60%" height="1.4rem" />
            <Skeleton width="85%" height="0.9rem" />
          </header>
        ) : null}
        <div className="product-skeleton-rows">
          {Array.from({ length: rows }).map((_, idx) => (
            <Skeleton key={idx} height={rowHeight} />
          ))}
        </div>
      </div>
    </section>
  );
}
