"use client";

import { useState, useTransition } from "react";

type WaitlistFormProps = {
  title: string;
  description: string;
  buttonLabel: string;
  source: string;
};

type FormState = {
  kind: "idle" | "success" | "error";
  message: string;
};

const initialState: FormState = {
  kind: "idle",
  message: "",
};

export function WaitlistForm({
  title,
  description,
  buttonLabel,
  source,
}: WaitlistFormProps) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<FormState>(initialState);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    startTransition(async () => {
      setState(initialState);

      try {
        const response = await fetch("/api/waitlist", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            source,
          }),
        });

        const payload = (await response.json()) as { message?: string };

        if (!response.ok) {
          setState({
            kind: "error",
            message:
              payload.message ??
              "Something blocked the signup. Please try again in a moment.",
          });
          return;
        }

        setState({
          kind: "success",
          message:
            payload.message ??
            "You’re on the list. Watch your inbox for launch updates.",
        });
        setEmail("");
      } catch {
        setState({
          kind: "error",
          message: "Network issue. Try again once your connection stabilizes.",
        });
      }
    });
  };

  return (
    <div className="form-shell stack-md">
      <div className="stack-sm">
        <span className="eyebrow-label">Primary CTA</span>
        <h2 className="text-3xl font-semibold uppercase tracking-tight">{title}</h2>
        <p className="section-copy">{description}</p>
      </div>

      <form className="form-grid" onSubmit={handleSubmit}>
        <label className="form-label" htmlFor={`email-${source}`}>
          Your work email
        </label>
        <input
          id={`email-${source}`}
          className="form-input"
          type="email"
          name="email"
          placeholder="you@company.com"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <button className="form-button" type="submit" disabled={isPending}>
          {isPending ? "Saving Your Spot..." : buttonLabel}
        </button>
      </form>

      <p className="form-footnote">
        No noise. Just product updates, release notes, and access invites.
      </p>

      {state.kind !== "idle" ? (
        <p className="form-message" data-state={state.kind}>
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
