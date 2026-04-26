import type { AccountBadge } from "@/lib/metis/types";

type AppTopbarProps = {
  eyebrow: string;
  title: string;
  description: string;
  chips?: AccountBadge[];
};

export function AppTopbar({
  eyebrow,
  title,
  description,
  chips = [],
}: AppTopbarProps) {
  return (
    <header className="product-topbar">
      <div className="product-topbar-copy">
        <span className="product-eyebrow">{eyebrow}</span>
        <h1 className="product-title">{title}</h1>
        <p className="product-description">{description}</p>
      </div>

      {chips.length ? (
        <div className="product-chip-row" aria-label="Pinned account context">
          {chips.map((chip) => (
            <div key={`${chip.role}-${chip.label}`} className="product-chip" data-tone={chip.tone}>
              <span className="product-chip-dot" aria-hidden="true" />
              <span>
                {chip.role}: {chip.label}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </header>
  );
}
