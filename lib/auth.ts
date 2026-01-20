import type { NextResponse } from "next/server";

import { cookies } from "next/headers";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { z } from "zod";

import {
  ApiEndpoint,
  OAUTH_STATE_COOKIE_NAME,
  PROVIDERS,
  type Provider,
  WORKFLOW_CONSTANTS,
} from "@/constants";
import { env } from "@/env";
import { TIME } from "@/lib/workflow/constants/workflow-limits";

type CookieOptions = Parameters<NextResponse["cookies"]["set"]>[2];

const CRYPTO = {
  ALGORITHM: "aes-256-gcm",
  IV_LENGTH: 12,
  TAG_LENGTH: 16,
  STATE_BYTES: 16,
  VERIFIER_BYTES: 32,
  CHUNK_SIZE: 3800,
  KEY: createHash("sha256").update(env.AUTH_SECRET).digest(),
} as const;

const TokenSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.number(),
  scope: z.array(z.string()),
});

export type Token = z.infer<typeof TokenSchema>;

const RefreshErrorSchema = z
  .object({
    error: z.string().optional(),
    error_description: z.string().optional(),
    error_codes: z.array(z.number()).optional(),
  })
  .passthrough();

export type RefreshTokenStatus = "ok" | "missing" | "reauth" | "failed";

export interface RefreshTokenResult {
  token: Token | null;
  status: RefreshTokenStatus;
  error?: {
    code?: string;
    description?: string;
  };
}

const CONFIGS = {
  [PROVIDERS.GOOGLE]: {
    authorizationUrl: ApiEndpoint.GoogleAuth.Authorize,
    clientId: env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri: "/api/auth/callback/google",
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
    ],
  },
  [PROVIDERS.MICROSOFT]: {
    authorizationUrl: ApiEndpoint.MicrosoftAuth.Authorize(
      env.MICROSOFT_TENANT ?? "organizations"
    ),
    clientId: env.MICROSOFT_OAUTH_CLIENT_ID,
    clientSecret: env.MICROSOFT_OAUTH_CLIENT_SECRET,
    redirectUri: "/api/auth/callback/microsoft",
    tokenUrl: ApiEndpoint.MicrosoftAuth.Token(
      env.MICROSOFT_TENANT ?? "organizations"
    ),
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
    ],
  },
} as const;

const REAUTH_ERROR_CODES = new Set([
  "invalid_grant",
  "invalid_rapt",
  "interaction_required",
  "login_required",
  "consent_required",
]);

// --- Crypto Helpers ---

export function encrypt(text: string): string {
  const iv = randomBytes(CRYPTO.IV_LENGTH);
  const cipher = createCipheriv(CRYPTO.ALGORITHM, CRYPTO.KEY, iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decrypt(encoded: string): string {
  const data = Buffer.from(encoded, "base64url");
  const iv = data.subarray(0, CRYPTO.IV_LENGTH);
  const tag = data.subarray(
    CRYPTO.IV_LENGTH,
    CRYPTO.IV_LENGTH + CRYPTO.TAG_LENGTH
  );
  const text = data.subarray(CRYPTO.IV_LENGTH + CRYPTO.TAG_LENGTH);
  const decipher = createDecipheriv(CRYPTO.ALGORITHM, CRYPTO.KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(text), decipher.final()]).toString(
    "utf8"
  );
}

export const generateState = () =>
  randomBytes(CRYPTO.STATE_BYTES).toString("hex");
export const generateCodeVerifier = () =>
  randomBytes(CRYPTO.VERIFIER_BYTES).toString("hex");
export const generateCodeChallenge = (verifier: string) =>
  createHash("sha256").update(verifier).digest("base64url");

// --- Cookie Management ---

const DEFAULT_COOKIE_OPTIONS: CookieOptions = { httpOnly: true, path: "/" };

export function setChunkedCookie(
  response: NextResponse,
  name: string,
  value: string,
  options: CookieOptions = DEFAULT_COOKIE_OPTIONS
) {
  const chunks = Math.ceil(value.length / CRYPTO.CHUNK_SIZE);

  for (let i = 0; i < chunks; i += 1) {
    const chunk = value.slice(
      i * CRYPTO.CHUNK_SIZE,
      (i + 1) * CRYPTO.CHUNK_SIZE
    );
    response.cookies.set(i === 0 ? name : `${name}-${i}`, chunk, options);
  }
}

export async function getChunkedCookie(
  name: string
): Promise<string | undefined> {
  const store = await cookies();
  const main = store.get(name);
  if (!main) {
    return undefined;
  }

  let { value } = main;
  let i = 1;
  while (store.has(`${name}-${i}`)) {
    value += store.get(`${name}-${i}`)?.value ?? "";
    i += 1;
  }
  return value;
}

export async function clearChunkedCookie(response: NextResponse, name: string) {
  const store = await cookies();
  response.cookies.delete(name);

  let i = 1;
  while (store.has(`${name}-${i}`)) {
    response.cookies.delete(`${name}-${i}`);
    i += 1;
  }
}

// --- OAuth Logic ---

export function generateAuthUrl(
  provider: Provider,
  state: string,
  baseUrl: string
): string {
  const config = CONFIGS[provider];
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: new URL(config.redirectUri, baseUrl).toString(),
    response_type: "code",
    scope: config.scopes.join(" "),
    state,
  });

  if (provider === PROVIDERS.GOOGLE) {
    params.set("access_type", "offline");
    params.set("prompt", "consent");
    if (env.GOOGLE_HD_DOMAIN) {
      params.set("hd", env.GOOGLE_HD_DOMAIN);
    }
  }

  if (provider === PROVIDERS.MICROSOFT && env.MICROSOFT_TENANT?.includes(".")) {
    params.set("domain_hint", env.MICROSOFT_TENANT);
  }

  return `${config.authorizationUrl}?${params.toString()}`;
}

export async function exchangeCodeForToken(
  provider: Provider,
  code: string,
  baseUrl: string
): Promise<Token> {
  const config = CONFIGS[provider];
  const redirectUri = new URL(config.redirectUri, baseUrl).toString();

  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }).toString(),
  });

  if (!res.ok) {
    throw new Error(`Token exchange failed: ${await res.text()}`);
  }

  const data = await res.json();
  return TokenSchema.parse({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * TIME.MS_IN_SECOND,
    scope: data.scope?.split(" ") || config.scopes,
  });
}

export async function getToken(provider: Provider): Promise<Token | null> {
  try {
    const encrypted = await getChunkedCookie(`${provider}_token`);
    if (!encrypted) {
      return null;
    }
    return TokenSchema.parse(JSON.parse(decrypt(encrypted)));
  } catch {
    return null;
  }
}

export async function setToken(
  response: NextResponse,
  provider: Provider,
  token: Token
) {
  const encrypted = encrypt(JSON.stringify(token));
  // Clean up old chunks
  await clearChunkedCookie(response, `${provider}_token`);
  setChunkedCookie(response, `${provider}_token`, encrypted, {
    httpOnly: true,
    maxAge: WORKFLOW_CONSTANTS.TOKEN_COOKIE_MAX_AGE,
    path: "/",
    secure: env.NODE_ENV === "production",
  });
}

async function parseRefreshError(
  response: Response
): Promise<RefreshTokenResult["error"] | undefined> {
  const body = await response.text();
  if (!body) {
    return undefined;
  }

  try {
    const parsed = RefreshErrorSchema.parse(JSON.parse(body));
    return {
      code: parsed.error,
      description: parsed.error_description,
    };
  } catch {
    return { description: body };
  }
}

function shouldReauth(error?: RefreshTokenResult["error"]): boolean {
  if (!error?.code) {
    return false;
  }

  return REAUTH_ERROR_CODES.has(error.code.toLowerCase());
}

export async function refreshTokenWithResult(
  provider: Provider,
  response?: NextResponse
): Promise<RefreshTokenResult> {
  const token = await getToken(provider);
  if (!token) {
    return { token: null, status: "missing" };
  }

  const now = Date.now();
  const refreshDue =
    token.expiresAt - now <= WORKFLOW_CONSTANTS.TOKEN_REFRESH_BUFFER_MS;
  if (!refreshDue) {
    return { token, status: "ok" };
  }

  if (!token.refreshToken) {
    const expired = token.expiresAt <= now;
    return { token: expired ? null : token, status: "reauth" };
  }

  try {
    const config = CONFIGS[provider];
    const res = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }).toString(),
    });

    if (!res.ok) {
      const error = await parseRefreshError(res);
      const expired = token.expiresAt <= now;
      const requiresReauth = shouldReauth(error);
      return {
        token: requiresReauth || expired ? null : token,
        status: requiresReauth ? "reauth" : "failed",
        error,
      };
    }

    const data = await res.json();
    const newToken = TokenSchema.parse({
      accessToken: data.access_token,
      // Keep old refresh token if not rotated
      refreshToken: data.refresh_token ?? token.refreshToken,
      expiresAt: Date.now() + data.expires_in * TIME.MS_IN_SECOND,
      scope: data.scope?.split(" ") || token.scope,
    });

    if (response) {
      await setToken(response, provider, newToken);
    }
    return { token: newToken, status: "ok" };
  } catch {
    const expired = token.expiresAt <= now;
    return { token: expired ? null : token, status: "failed" };
  }
}

export async function refreshTokenIfNeeded(
  provider: Provider,
  response?: NextResponse
): Promise<Token | null> {
  const result = await refreshTokenWithResult(provider, response);
  return result.token;
}

export async function validateOAuthState(state: string, provider: Provider) {
  try {
    const encrypted = await getChunkedCookie(OAUTH_STATE_COOKIE_NAME);
    if (!encrypted) {
      return false;
    }

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
