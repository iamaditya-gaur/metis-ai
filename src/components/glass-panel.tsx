type GlassPanelProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  busy?: boolean;
  overlay?: React.ReactNode;
  children?: React.ReactNode;
};

export function GlassPanel({
  eyebrow,
  title,
  description,
  actions,
  className,
  busy = false,
  overlay,
  children,
}: GlassPanelProps) {
  return (
    <section
      className={["glass-panel", className].filter(Boolean).join(" ")}
      data-busy={busy ? "true" : undefined}
      aria-busy={busy}
    >
      <div className="glass-panel-content">
        {eyebrow || title || description || actions ? (
          <header className="glass-panel-head">
            {eyebrow ? <span className="product-eyebrow">{eyebrow}</span> : null}
            {title ? <h2 className="glass-panel-title">{title}</h2> : null}
            {description ? <p className="glass-panel-description">{description}</p> : null}
            {actions ? <div className="glass-panel-actions">{actions}</div> : null}
          </header>
        ) : null}
        {children}
      </div>
      {overlay ? <div className="glass-panel-overlay">{overlay}</div> : null}
    </section>
  );
}
