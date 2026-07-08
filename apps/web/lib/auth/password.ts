import "server-only";
import { hash, verify } from "@node-rs/argon2";

/**
 * Hashes a plaintext password with argon2id (library defaults, which follow
 * the OWASP-recommended parameters).
 */
export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

/**
 * Verifies a plaintext password against a stored argon2 hash. Returns false on
 * any verification error rather than throwing.
 */
export async function verifyPassword(
  storedHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await verify(storedHash, password);
  } catch {
    return false;
  }
}
