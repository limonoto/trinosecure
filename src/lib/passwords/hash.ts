import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import type { PasswordEncoding } from "@/generated/prisma/enums";

/**
 * Password hashing for Trino's `password.db` (requirement 2.1 — "password
 * decryption type'ı belirlenebilmeli"). Trino's file authenticator accepts two
 * on-disk formats:
 *   - bcrypt  → "$2y$<cost>$..." (min cost 8)
 *   - PBKDF2  → "<iterations>:<saltHex>:<hashHex>" using PBKDF2WithHmacSHA256,
 *     keyLength = hashBytes*8 (Trino's io.trino.plugin.password.file.EncryptionUtil)
 *
 * Both produce a digest Trino can verify; plaintext is never stored.
 */

const BCRYPT_ROUNDS = 10;
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_SALT_BYTES = 16;
const PBKDF2_KEY_BYTES = 32; // 256-bit derived key

function pbkdf2Hash(plain: string): string {
  const salt = randomBytes(PBKDF2_SALT_BYTES);
  const derived = pbkdf2Sync(plain, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_BYTES, "sha256");
  return `${PBKDF2_ITERATIONS}:${salt.toString("hex")}:${derived.toString("hex")}`;
}

/** Verify a plaintext against a Trino PBKDF2 digest (used in tests / future re-auth). */
export function verifyPbkdf2(plain: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 3) return false;
  const iterations = Number.parseInt(parts[0], 10);
  if (!Number.isInteger(iterations) || iterations <= 0) return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[1], "hex");
    expected = Buffer.from(parts[2], "hex");
  } catch {
    return false;
  }
  if (expected.length === 0) return false;
  const actual = pbkdf2Sync(plain, salt, iterations, expected.length, "sha256");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Detect the encoding of a stored Trino password hash. */
export function detectEncoding(hash: string): PasswordEncoding | null {
  if (hash.startsWith("$2y$") || hash.startsWith("$2a$") || hash.startsWith("$2b$")) return "BCRYPT";
  if (/^\d+:[0-9a-f]+:[0-9a-f]+$/i.test(hash)) return "PBKDF2";
  return null;
}

/** Hash a plaintext password in the requested Trino-compatible encoding. */
export async function hashPassword(plain: string, encoding: PasswordEncoding): Promise<string> {
  if (encoding === "PBKDF2") return pbkdf2Hash(plain);
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}
