#!/usr/bin/env node
// Lightweight signup verification — no browser, no dev server.
// Reproduces what signUpAction does server-side. ~50MB peak.
//
// Reads .env.local from cwd, creates a throwaway confirmed Supabase user,
// then deletes it. Pass on green, exit non-zero on any failure with the
// actual error.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadDotenvFile(path) {
  try {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    // Ignore — env may already be in shell.
  }
}

loadDotenvFile(resolve(process.cwd(), ".env.local"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("env check:", {
  NEXT_PUBLIC_SUPABASE_URL: Boolean(url),
  SUPABASE_SERVICE_ROLE_KEY: Boolean(serviceRoleKey),
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || "(unset)",
});

if (!url || !serviceRoleKey) {
  console.error("FAIL: required env vars missing.");
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const email = `qa-verify-${Date.now()}@example.com`;
const password = "testpassword123";

console.log(`\ncreating user ${email} (email_confirm: true)...`);

const { data: created, error: createError } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (createError) {
  console.error("FAIL: admin.createUser ->", {
    code: createError.code,
    message: createError.message,
    status: createError.status,
  });
  process.exit(2);
}

console.log("OK: user created", { id: created.user?.id, email: created.user?.email });

// Auto-confirm sanity check
if (!created.user?.email_confirmed_at) {
  console.error("FAIL: user was created but email_confirmed_at is null");
  process.exit(3);
}
console.log("OK: email_confirmed_at set");

// Verify sign-in works
const { error: signInError } = await admin.auth.signInWithPassword({
  email,
  password,
});

if (signInError) {
  console.error("FAIL: signInWithPassword ->", signInError.message);
  process.exit(4);
}
console.log("OK: signInWithPassword succeeded");

// Cleanup so the table doesn't fill with QA users
const { error: deleteError } = await admin.auth.admin.deleteUser(
  created.user.id,
);
if (deleteError) {
  console.warn("WARN: cleanup deleteUser failed:", deleteError.message);
} else {
  console.log("OK: test user deleted");
}

console.log("\nALL GREEN: signup flow verified end-to-end via admin API.");
