import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM wrapper for storing user secrets (Meta access tokens, Slack
 * webhooks, etc.) at rest. The key lives in METIS_TOKEN_ENCRYPTION_KEY as a
 * 64-character hex string (32 bytes). Generate with `openssl rand -hex 32`.
 *
 * Each encryption produces a fresh random 12-byte IV. The 16-byte auth tag
 * is stored alongside the ciphertext so tampering is detected on decrypt.
 *
 * Ciphertext / iv / authTag are returned as Buffers so callers can hand them
 * straight to a Postgres `bytea` column via supabase-js.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH_BYTES = 32;

export type EncryptedSecret = {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
};

function getKey(): Buffer {
  const raw = process.env.METIS_TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error("METIS_TOKEN_ENCRYPTION_KEY is not set.");
  }
  if (!/^[0-9a-fA-F]+$/.test(raw)) {
    throw new Error("METIS_TOKEN_ENCRYPTION_KEY must be hex.");
  }
  const key = Buffer.from(raw, "hex");
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error(
      `METIS_TOKEN_ENCRYPTION_KEY must decode to ${KEY_LENGTH_BYTES} bytes (got ${key.length}).`,
    );
  }
  return key;
}

export function encryptSecret(plaintext: string): EncryptedSecret {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new Error("encryptSecret requires a non-empty string.");
  }

  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return { ciphertext, iv, authTag };
}

export type EncryptedSecretBase64 = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

export function encryptSecretToBase64(plaintext: string): EncryptedSecretBase64 {
  const { ciphertext, iv, authTag } = encryptSecret(plaintext);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export function decryptSecretFromBase64(parts: EncryptedSecretBase64): string {
  return decryptSecret({
    ciphertext: Buffer.from(parts.ciphertext, "base64"),
    iv: Buffer.from(parts.iv, "base64"),
    authTag: Buffer.from(parts.authTag, "base64"),
  });
}

export function decryptSecret(parts: EncryptedSecret): string {
  if (
    !Buffer.isBuffer(parts.ciphertext) ||
    !Buffer.isBuffer(parts.iv) ||
    !Buffer.isBuffer(parts.authTag)
  ) {
    throw new Error("decryptSecret requires Buffer parts.");
  }
  if (parts.iv.length !== IV_LENGTH) {
    throw new Error(`IV must be ${IV_LENGTH} bytes.`);
  }
  if (parts.authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(`Auth tag must be ${AUTH_TAG_LENGTH} bytes.`);
  }

  const key = getKey();
  const decipher = createDecipheriv(ALGORITHM, key, parts.iv);
  decipher.setAuthTag(parts.authTag);
  const plaintext = Buffer.concat([
    decipher.update(parts.ciphertext),
    decipher.final(),
  ]).toString("utf8");
  return plaintext;
}
