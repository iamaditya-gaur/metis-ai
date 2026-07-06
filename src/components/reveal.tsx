"use client";

import {
  useEffect,
  useRef,
  type CSSProperties,
  type ElementType,
  type ReactNode,
  type Ref,
} from "react";

type RevealProps = {
  as?: ElementType;
  className?: string;
  /** Stagger offset in ms, applied via --fx-delay. */
  delay?: number;
  /** Reveal a single time instead of replaying on every scroll pass. */
  once?: boolean;
  children?: ReactNode;
} & Record<string, unknown>;

// Reveals on downward entry only: data-revealed is set when the element
// scrolls into view, kept when it leaves through the top (so scrolling back
// up never replays animations), and cleared only when it leaves through the
// bottom — re-arming the entrance for the next downward pass. The gap
// between the two thresholds (0 and 0.12) is hysteresis — no flicker at
// viewport edges. The hidden initial state only applies when scripting is
// enabled (see .fx-reveal in globals.css), so content is never lost if JS
// fails.
export function Reveal({
  as = "div",
  className,
  delay = 0,
  once = false,
  children,
  ...rest
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      node.dataset.revealed = "true";
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          if (entry.intersectionRatio >= 0.12) {
            el.dataset.revealed = "true";
            if (once) observer.unobserve(el);
          } else if (
            !entry.isIntersecting &&
            !once &&
            entry.boundingClientRect.top > 0
          ) {
            delete el.dataset.revealed;
          }
        }
      },
      { threshold: [0, 0.12] },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [once]);

  const style = delay
    ? ({ "--fx-delay": `${delay}ms` } as CSSProperties)
    : undefined;

  const Tag = as;

  return (
    <Tag
      {...rest}
      ref={ref as Ref<HTMLElement>}
      className={className ? `fx-reveal ${className}` : "fx-reveal"}
      style={style}
    >
      {children}
    </Tag>
  );
}
