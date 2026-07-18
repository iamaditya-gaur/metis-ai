import { decryptSecretFromBase64, encryptSecretToBase64 } from "@/lib/crypto/token-encryption";
import { createClient } from "@/lib/supabase/server";

export type LlmProvider = "openrouter" | "openai";

export type LlmKeySummary = {
  provider: LlmProvider;
  lastFour: string;
  lastValidatedAt: string | null;
};

/** Validates the key against the provider before saving. Throws on rejection. */
export async function validateLlmKey(provider: LlmProvider, apiKey: string): Promise<void> {
  const probe =
    provider === "openrouter"
      ? "https://openrouter.ai/api/v1/key"
      : "https://api.openai.com/v1/models";
  const response = await fetch(probe, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) {
    throw new Error(
      provider === "openrouter"
        ? "OpenRouter rejected this key."
        : "OpenAI rejected this key. Check it at platform.openai.com → API keys.",
    );
  }
}

export async function saveLlmKey(provider: LlmProvider, apiKey: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in first.");

  await validateLlmKey(provider, apiKey);
  const parts = encryptSecretToBase64(apiKey);
  const { error } = await supabase.from("llm_keys").upsert(
    {
      user_id: user.id,
      provider,
      ciphertext: parts.ciphertext,
      iv: parts.iv,
      auth_tag: parts.authTag,
      last_four: apiKey.slice(-4),
      last_validated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`Couldn't save the key: ${error.message}`);
}

export async function getLlmKeySummary(): Promise<LlmKeySummary | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("llm_keys")
    .select("provider, last_four, last_validated_at")
    .maybeSingle();
  if (!data) return null;
  return {
    provider: data.provider as LlmProvider,
    lastFour: data.last_four,
    lastValidatedAt: data.last_validated_at,
  };
}

/** Decrypts the signed-in user's key for a run. Returns null when absent. */
export async function resolveLlmKeyForRun(): Promise<{
  provider: LlmProvider;
  apiKey: string;
} | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("llm_keys")
    .select("provider, ciphertext, iv, auth_tag")
    .maybeSingle();
  if (!data) return null;
  return {
    provider: data.provider as LlmProvider,
    apiKey: decryptSecretFromBase64({
      ciphertext: data.ciphertext,
      iv: data.iv,
      authTag: data.auth_tag,
    }),
  };
}

export async function deleteLlmKey(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("llm_keys").delete().neq("provider", "");
  if (error) throw new Error(`Couldn't delete the key: ${error.message}`);
}
