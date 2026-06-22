"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  value: string;
  label?: string;
};

async function copyTextToClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const succeeded = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!succeeded) {
    throw new Error("Copy command failed.");
  }
}

export function HistoryCopyButton({ value, label = "Copy" }: Props) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const resetRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetRef.current) window.clearTimeout(resetRef.current);
    };
  }, []);

  const handleClick = async () => {
    try {
      await copyTextToClipboard(value);
      setState("copied");
    } catch {
      setState("failed");
    }
    if (resetRef.current) window.clearTimeout(resetRef.current);
    resetRef.current = window.setTimeout(() => {
      setState("idle");
      resetRef.current = null;
    }, 1800);
  };

  return (
    <button
      type="button"
      className="history-copy-button"
      data-state={state}
      onClick={handleClick}
      disabled={!value}
    >
      {state === "copied" ? "Copied" : state === "failed" ? "Try again" : label}
    </button>
  );
}
