import { randomBytes } from "node:crypto";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/app/auth/schema";

const LOWER = "abcdefghijkmnopqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "@#$%&*-_=+";
const ALPHABET = LOWER + UPPER + DIGITS + SYMBOLS;

function pick(pool: string, byte: number): string {
  return pool[byte % pool.length] ?? pool[0]!;
}

/**
 * Mot de passe aléatoire cryptographiquement sûr, compatible Better Auth (longueur + complexité).
 */
export function generateSecurePassword(length = 16): string {
  const target = Math.min(Math.max(length, MIN_PASSWORD_LENGTH), MAX_PASSWORD_LENGTH);
  const buf = randomBytes(target);
  const chars: string[] = [];
  for (let i = 0; i < target; i++) {
    chars.push(pick(ALPHABET, buf[i]!));
  }
  chars[0] = pick(LOWER, buf[0]!);
  chars[1] = pick(UPPER, buf[1]!);
  chars[2] = pick(DIGITS, buf[2]!);
  chars[3] = pick(SYMBOLS, buf[3]!);
  for (let i = target - 1; i > 0; i--) {
    const j = buf[i % buf.length]! % (i + 1);
    const a = chars[i]!;
    const b = chars[j]!;
    chars[i] = b;
    chars[j] = a;
  }
  return chars.join("");
}
