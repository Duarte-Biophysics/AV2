import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function hashPassword(password: string) {
  const salt = randomBytes(32).toString("hex");
  return { salt, hash: digest(salt, password) };
}

export function verifyPassword(salt: string, expected: string, password: string): boolean {
  const got = Buffer.from(digest(salt, password), "hex");
  const stored = Buffer.from(expected, "hex");
  return got.length === stored.length && timingSafeEqual(got, stored);
}

function digest(salt: string, password: string): string {
  return createHash("sha256").update(salt).update(":").update(password).digest("hex");
}
