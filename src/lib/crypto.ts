import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY env var is not set");
  const buf = Buffer.from(raw, "hex");
  if (buf.length !== 32) throw new Error("ENCRYPTION_KEY must be 64 hex characters (32 bytes)");
  return buf;
}

/**
 * Encrypt a UTF-8 string with AES-256-GCM.
 * Returns `iv:authTag:ciphertext` (all hex) — safe to store in the database.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

/**
 * Decrypt a value produced by `encrypt`. Throws on tampered or malformed input.
 */
export function decrypt(stored: string): string {
  const key = getKey();
  const parts = stored.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted value format");
  const [ivHex, tagHex, ctHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");
  const ciphertext = Buffer.from(ctHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
