import { GlassPanel } from "@/components/glass-panel";
import { StatusPill } from "@/components/status-pill";
import type { AccountOption } from "@/lib/metis/types";

type AccountSelectorCardProps = {
  accounts: AccountOption[];
};

export function AccountSelectorCard({ accounts }: AccountSelectorCardProps) {
  return (
    <GlassPanel
      eyebrow="Accounts"
      title="Dedicated first-run account selection"
      description="Keep the default accounts obvious and show account names everywhere the workflow could create risk."
    >
      <div className="product-list">
        {accounts.length ? accounts.map((account) => (
          <article key={account.id} className="product-list-item">
            <div className="product-list-title">
              <div>
                <p className="product-label">
                  {account.role === "reporting-default"
                    ? "Reporting"
                    : account.role === "builder-default"
                      ? "Builder"
                      : "Accessible account"}
                </p>
                <strong>{account.label}</strong>
              </div>
              <StatusPill
                label={
                  account.role === "reporting-default"
                    ? "Default"
                    : account.role === "builder-default"
                      ? "Draft-safe default"
                      : "Available"
                }
                tone={
                  account.role === "reporting-default"
                    ? "success"
                    : account.role === "builder-default"
                      ? "warning"
                      : "neutral"
                }
              />
            </div>
            <p className="product-help">
              {account.role === "reporting-default"
                ? "Use the client account by default for reporting so the generated summary stays grounded in the intended account context."
                : account.role === "builder-default"
                  ? "Builder should default here and explicitly warn before switching away so the write path does not drift into the wrong account."
                  : `${account.name ?? "Accessible account"}${account.currency ? ` · ${account.currency}` : ""}${account.timezoneName ? ` · ${account.timezoneName}` : ""}`}
            </p>
          </article>
        )) : (
          <article className="product-list-item">
            <strong>No accessible accounts loaded</strong>
            <p className="product-help">
              Setup can render without account data, but account selection will only become live once Meta access is available.
            </p>
          </article>
        )}
      </div>

      <div className="product-warning">
        Switching the builder account should surface a strong warning and keep the paused-only rule visible before draft creation.
      </div>
    </GlassPanel>
  );
}
