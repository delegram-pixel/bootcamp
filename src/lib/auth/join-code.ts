import "server-only";

import { randomBytes } from "node:crypto";

// Unambiguous alphabet — no 0/O/1/I/L — so a code is easy to read and share.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 30 chars
const DEFAULT_LENGTH = 10;

// 240 = floor(256 / 30) * 30. Bytes 0–239 map uniformly onto the 30-char
// alphabet; we reject 240–255 to avoid modulo bias.
const UNBIASED_CEILING = 240;

/**
 * A shareable cohort invite code — e.g. "K7P9QXR3MT". Not a capability token
 * (it only gates intern self-registration), but ~49 bits of entropy makes
 * online guessing impractical. Rotatable: regenerating replaces it, which
 * invalidates any previously shared link.
 */
export function newJoinCode(length: number = DEFAULT_LENGTH): string {
  const out: string[] = [];
  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (out.length === length) break;
      if (byte < UNBIASED_CEILING) out.push(ALPHABET[byte % ALPHABET.length]);
    }
  }
  return out.join("");
}
