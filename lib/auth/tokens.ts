import {
  OAUTH_STATE_COOKIE_NAME,
  Provider,
  WORKFLOW_CONSTANTS
} from "@/constants";
import { cookies } from "next/headers";
import { decrypt, encrypt } from "./crypto";
import { Token } from "./oauth";

export async function getToken(provider: Provider): Promise<Token | null> {
  const cookieName = `${provider}_token`;
  const cookie = (await cookies()).get(cookieName);
  if (!cookie) return null;
  try {
    const data = decrypt(cookie.value);
    return JSON.parse(data) as Token;
  } catch {
    return null;
  }
}

export async function setToken(
  provider: Provider,
  token: Token
): Promise<void> {
  const encrypted = encrypt(JSON.stringify(token));
  const cookieName = `${provider}_token`;
  (await cookies()).set({
    name: cookieName,
    value: encrypted,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: WORKFLOW_CONSTANTS.TOKEN_COOKIE_MAX_AGE
  });
}

export async function validateOAuthState(
  state: string,
  provider: Provider
): Promise<boolean> {
  const cookie = (await cookies()).get(OAUTH_STATE_COOKIE_NAME);
  if (!cookie) return false;
  try {
    const data = JSON.parse(decrypt(cookie.value));
    return (
      data.state === state
      && data.provider === provider
      && Date.now() - data.timestamp < WORKFLOW_CONSTANTS.OAUTH_STATE_TTL_MS
    );
  } catch {
    return false;
  }
}
