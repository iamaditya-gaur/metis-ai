type ProcessingIndicatorProps = {
  mode?: "panel" | "inline";
};

type ProcessingOverlayProps = {
  eyebrow?: string;
  title: string;
  description: string;
  steps?: string[];
};

export function ProcessingIndicator({ mode = "panel" }: ProcessingIndicatorProps) {
  return (
    <span
      className={[
        "processing-indicator",
        mode === "inline" ? "processing-indicator--inline" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden="true"
    >
      <span className="processing-indicator-ring processing-indicator-ring--outer" />
      <span className="processing-indicator-ring processing-indicator-ring--inner" />
      <span className="processing-indicator-core" />
    </span>
  );
}

export function ProcessingOverlay({
  eyebrow = "Processing",
  title,
  description,
  steps = [],
}: ProcessingOverlayProps) {
  return (
    <div className="processing-overlay" role="status" aria-live="polite" aria-atomic="true">
      <div className="processing-overlay-card">
        <ProcessingIndicator />
        <div className="processing-overlay-copy">
          <span className="processing-overlay-eyebrow">{eyebrow}</span>
          <strong className="processing-overlay-title">{title}</strong>
          <p className="processing-overlay-description">{description}</p>
        </div>
        {steps.length ? (
          <ul className="processing-overlay-steps">
            {steps.map((step) => (
              <li key={step} className="processing-overlay-step">
                {step}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
