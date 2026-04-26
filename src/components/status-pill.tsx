import type { StatusTone } from "@/lib/metis/types";

type StatusPillProps = {
  label: string;
  tone?: StatusTone;
  isActive?: boolean;
};

export function StatusPill({
  label,
  tone = "info",
  isActive = false,
}: StatusPillProps) {
  return (
    <span className="status-pill" data-tone={tone} data-active={isActive ? "true" : undefined}>
      {label}
    </span>
  );
}
