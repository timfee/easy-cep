import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import {
  ApiEndpoint,
  OAUTH_STATE_COOKIE_NAME,
  PROVIDERS,
  type Provider,
  WORKFLOW_CONSTANTS,
} from "@/constants";
import { env } from "@/env";
import { TIME } from "@/lib/workflow/constants/workflow-limits";

/** Cookie option type for NextResponse.cookies.set */
// disable magic number for tuple index accessing the third parameter type

type CookieOptions = Parameters<NextResponse["cookies"]["set"]>[2];

/** Size of each cookie chunk in bytes */
const CHUNK_SIZE = 3800;

/**
 * Encrypt/decrypt configuration.
 */
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const STATE_BYTES = 16;
const VERIFIER_BYTES = 32;
const key = createHash("sha256").update(env.AUTH_SECRET).digest();

/**
 * Encrypt plain text with AES-GCM.
 */
export function encrypt(text: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

/**
 * Decrypt text produced by {@link encrypt}.
 */
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

/** Generate a random OAuth state parameter. */
export function generateState(): string {
  return randomBytes(STATE_BYTES).toString("hex");
}

/** Generate a PKCE code verifier. */
export function generateCodeVerifier(): string {
  return randomBytes(VERIFIER_BYTES).toString("hex");
}

/** Generate a PKCE code challenge from a verifier. */
export function generateCodeChallenge(verifier: string): string {
  const hash = createHash("sha256").update(verifier).digest();
  return hash.toString("base64url");
}

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
}

const googleOAuthConfig: OAuthConfig = {
  clientId: env.GOOGLE_OAUTH_CLIENT_ID,
  clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
  redirectUri: "/api/auth/callback/google",
  authorizationUrl: ApiEndpoint.GoogleAuth.Authorize,
  tokenUrl: ApiEndpoint.GoogleAuth.Token,
  scopes: [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/admin.directory.user",
    "https://www.googleapis.com/auth/admin.directory.orgunit",
    "https://www.googleapis.com/auth/admin.directory.domain",
    "https://www.googleapis.com/auth/admin.directory.rolemanagement",
    "https://www.googleapis.com/auth/cloud-identity.inboundsso",
    "https://www.googleapis.com/auth/siteverification",
    "https://www.googleapis.com/auth/admin.directory.rolemanagement",
  ],
};

const microsoftOAuthConfig: OAuthConfig = {
  clientId: env.MICROSOFT_OAUTH_CLIENT_ID,
  clientSecret: env.MICROSOFT_OAUTH_CLIENT_SECRET,
  redirectUri: "/api/auth/callback/microsoft",
  authorizationUrl: ApiEndpoint.MicrosoftAuth.Authorize,
  tokenUrl: ApiEndpoint.MicrosoftAuth.Token,
  scopes: [
    "openid",
    "profile",
    "email",
    "offline_access",
    "User.Read",
    "Directory.Read.All",
    "Application.ReadWrite.All",
    "AppRoleAssignment.ReadWrite.All",
    "Policy.ReadWrite.ApplicationConfiguration",
    "offline_access",
  ],
};

function getOAuthConfig(provider: Provider): OAuthConfig {
  return provider === PROVIDERS.GOOGLE
    ? googleOAuthConfig
    : microsoftOAuthConfig;
}

export interface Token {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function parseToken(value: unknown): Token | null {
  if (!isRecord(value)) {
    return null;
  }

  const { accessToken, refreshToken, expiresAt, scope } = value;
  if (
    typeof accessToken !== "string" ||
    typeof refreshToken !== "string" ||
    typeof expiresAt !== "number" ||
    !isStringArray(scope)
  ) {
    return null;
  }

  return { accessToken, refreshToken, expiresAt, scope };
}

/**
 * Generate the provider authorization URL.
 */
export function generateAuthUrl(
  provider: Provider,
  state: string,
  baseUrl: string
): string {
  const config = getOAuthConfig(provider);
  const params = new URLSearchParams();
  const redirectUri = new URL(config.redirectUri, baseUrl).toString();
  params.set("client_id", config.clientId);
  params.set("redirect_uri", redirectUri);
  params.set("response_type", "code");
  params.set("scope", config.scopes.join(" "));
  params.set("state", state);
  if (provider === PROVIDERS.GOOGLE) {
    params.set("access_type", "offline");
    params.set("prompt", "consent");
  }
  return `${config.authorizationUrl}?${params.toString()}`;
}

/**
 * Exchange an authorization code for an access token.
 */
export async function exchangeCodeForToken(
  provider: Provider,
  code: string,
  baseUrl: string
): Promise<Token> {
  const config = getOAuthConfig(provider);
  const redirectUri = new URL(config.redirectUri, baseUrl).toString();
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * TIME.MS_IN_SECOND,
    scope: data.scope?.split(" ") || config.scopes,
  };
}

/** Retrieve an encrypted token from cookies. */
/** Retrieve an encrypted token from chunked cookies. */
export async function getToken(provider: Provider): Promise<Token | null> {
  const cookieName = `${provider}_token`;
  const encrypted = await getChunkedCookie(cookieName);
  if (!encrypted) {
    return null;
  }
  try {
    const data = decrypt(encrypted);
    return parseToken(JSON.parse(data));
  } catch {
    return null;
  }
}

export async function refreshTokenIfNeeded(
  provider: Provider,
  response?: NextResponse
): Promise<Token | null> {
  const token = await getToken(provider);
  if (!token) {
    return null;
  }

  const expiresIn = token.expiresAt - Date.now();
  if (expiresIn > WORKFLOW_CONSTANTS.TOKEN_REFRESH_BUFFER_MS) {
    return token;
  }

  if (!token.refreshToken) {
    return null;
  }

  try {
    const config = getOAuthConfig(provider);
    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: token.refreshToken,
      grant_type: "refresh_token",
    });

    const res = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    const newToken: Token = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || token.refreshToken,
      expiresAt: Date.now() + data.expires_in * TIME.MS_IN_SECOND,
      scope: data.scope?.split(" ") || token.scope,
    };

    if (response) {
      await setToken(response, provider, newToken);
    }

    return newToken;
  } catch {
    return null;
  }
}

/** Store an encrypted token in cookies. */
/** Store an encrypted token in chunked cookies. */
export async function setToken(
  response: NextResponse,
  provider: Provider,
  token: Token
): Promise<void> {
  const encrypted = encrypt(JSON.stringify(token));
  const cookieName = `${provider}_token`;
  await clearChunkedCookie(response, cookieName);
  await setChunkedCookie(response, cookieName, encrypted, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: WORKFLOW_CONSTANTS.TOKEN_COOKIE_MAX_AGE,
  });
}

/**
 * Validate and clear the OAuth state cookie.
 */
/** Validate the OAuth state stored in chunked cookies. */
export async function validateOAuthState(
  state: string,
  provider: Provider
): Promise<boolean> {
  const encrypted = await getChunkedCookie(OAUTH_STATE_COOKIE_NAME);
  if (!encrypted) {
    return false;
  }
  try {
    const data = JSON.parse(decrypt(encrypted));
    return (
      data.state === state &&
      data.provider === provider &&
      Date.now() - data.timestamp < WORKFLOW_CONSTANTS.OAUTH_STATE_TTL_MS
    );
  } catch {
    return false;
  }
}

/** Set a cookie value split into multiple chunks. */
export function setChunkedCookie(
  response: NextResponse,
  name: string,
  value: string,
  options?: CookieOptions
) {
  const chunks = Math.ceil(value.length / CHUNK_SIZE);
  const defaults: CookieOptions = { httpOnly: true, path: "/" };
  for (let i = 0; i < chunks; i++) {
    const chunk = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const cookieName = i === 0 ? name : `${name}-${i}`;
    response.cookies.set(cookieName, chunk, { ...defaults, ...options });
  }
}

/** Retrieve a value stored via {@link setChunkedCookie}. */
export async function getChunkedCookie(
  name: string
): Promise<string | undefined> {
  try {
    const store = await cookies();
    const first = store.get(name);
    if (!first) {
      return undefined;
    }
    let value = first.value;
    for (let i = 1; ; i++) {
      const part = store.get(`${name}-${i}`);
      if (!part) {
        break;
      }
      value += part.value;
    }
    return value;
  } catch {
    return undefined;
  }
}

/** Clear cookies created via {@link setChunkedCookie}. */
export async function clearChunkedCookie(response: NextResponse, name: string) {
  try {
    const store = await cookies();
    if (store.get(name)) {
      response.cookies.delete(name);
    }
    for (let i = 1; ; i++) {
      const part = store.get(`${name}-${i}`);
      if (!part) {
        break;
      }
      response.cookies.delete(`${name}-${i}`);
    }
  } catch {
    /* ignore cookie clearing errors */
  }
}
