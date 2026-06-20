"use client";

import { signOutAction } from "@/app/(auth)/actions";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button type="submit" className="product-button" data-variant="secondary">
        Sign out of this browser
      </button>
    </form>
  );
}
