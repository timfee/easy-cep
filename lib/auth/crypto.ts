import { env } from "@/env";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const STATE_BYTES = 16;
const VERIFIER_BYTES = 32;
const key = createHash("sha256").update(env.AUTH_SECRET).digest();

export function encrypt(text: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decrypt(encoded: string): string {
  const data = Buffer.from(encoded, "base64url");
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const text = data.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(text), decipher.final()]);
  return dec.toString("utf8");
}

export function generateState(): string {
  return randomBytes(STATE_BYTES).toString("hex");
}

export function generateCodeVerifier(): string {
  return randomBytes(VERIFIER_BYTES).toString("hex");
}

export function generateCodeChallenge(verifier: string): string {
  const hash = createHash("sha256").update(verifier).digest();
  return hash.toString("base64url");
}
