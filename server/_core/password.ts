import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

/**
 * Password hashing using Node's built-in scrypt KDF.
 *
 * We deliberately avoid bcrypt/argon2 to keep the dependency surface small and
 * avoid native build steps. scrypt is a memory-hard KDF included in Node core
 * and is appropriate for password storage.
 *
 * Stored format (single string column): `scrypt$<saltHex>$<hashHex>`
 */

const scrypt = promisify(_scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const SALT_BYTES = 16;

/** Hash a plaintext password for storage. */
export async function hashPassword(plaintext: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scrypt(plaintext.normalize("NFKC"), salt, KEY_LENGTH);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/**
 * Verify a plaintext password against a stored hash.
 * Uses a constant-time comparison to avoid timing side-channels.
 */
export async function verifyPassword(
  plaintext: string,
  stored: string | null | undefined
): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;

  const [, saltHex, hashHex] = parts;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length === 0) return false;

  const derived = await scrypt(plaintext.normalize("NFKC"), salt, expected.length);
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
