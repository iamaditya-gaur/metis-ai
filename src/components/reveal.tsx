"use client";

import {
  createElement,
  useEffect,
  useRef,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";

type RevealProps = {
  as?: ElementType;
  className?: string;
  /** Stagger offset in ms, applied via --fx-delay. */
  delay?: number;
  children?: ReactNode;
} & Record<string, unknown>;

// Adds data-revealed once the element scrolls into view, so CSS can
// transition it in. Reveals exactly once; the hidden initial state only
// applies when scripting is enabled (see .fx-reveal in globals.css), so
// content is never lost if JS fails.
export function Reveal({
  as = "div",
  className,
  delay = 0,
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
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).dataset.revealed = "true";
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const style = delay
    ? ({ "--fx-delay": `${delay}ms` } as CSSProperties)
    : undefined;

  return createElement(
    as,
    {
      ...rest,
      ref,
      className: className ? `fx-reveal ${className}` : "fx-reveal",
      style,
    },
    children,
  );
}
