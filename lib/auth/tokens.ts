import {
  OAUTH_STATE_COOKIE_NAME,
  Provider,
  WORKFLOW_CONSTANTS
} from "@/constants";
import { decrypt, encrypt } from "./crypto";
import { Token } from "./oauth";
import { getChunkedCookie, setChunkedCookie, clearChunkedCookie } from "@/lib/chunked-cookies";
import { NextResponse } from "next/server";

export async function getToken(provider: Provider): Promise<Token | null> {
  const cookieName = `${provider}_token`;
  const encrypted = await getChunkedCookie(cookieName);
  if (!encrypted) return null;
  try {
    const data = decrypt(encrypted);
    return JSON.parse(data) as Token;
  } catch {
    return null;
  }
}

export async function setToken(
  response: NextResponse,
  provider: Provider,
  token: Token
): Promise<void> {
  const encrypted = encrypt(JSON.stringify(token));
  const cookieName = `${provider}_token`;
  await clearChunkedCookie(response, cookieName);
  await setChunkedCookie(response, cookieName, encrypted);
}

export async function validateOAuthState(
  state: string,
  provider: Provider
): Promise<boolean> {
  const encrypted = await getChunkedCookie(OAUTH_STATE_COOKIE_NAME);
  if (!encrypted) return false;
  try {
    const data = JSON.parse(decrypt(encrypted));
    return (
      data.state === state
      && data.provider === provider
      && Date.now() - data.timestamp < WORKFLOW_CONSTANTS.OAUTH_STATE_TTL_MS
    );
  } catch {
    return false;
  }
}
