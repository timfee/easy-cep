import "tsconfig-paths/register";
import { ApiEndpoint } from "@/constants";
import { env } from "@/env";
import {
  getBearerTokens,
  normalizeEnvValue,
  REQUIRED_GOOGLE_SCOPES,
  REQUIRED_MICROSOFT_SCOPES,
} from "@/lib/testing/tokens";

const TEST_ENV_FETCH_TIMEOUT_MS = 5000;

const fetchWithTimeout = async (url: string, options: RequestInit) => {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    TEST_ENV_FETCH_TIMEOUT_MS
  );
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const decodeJwtPayload = (token: string) => {
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }
  const payload = parts[1] ?? "";
  const padded = payload.padEnd(
    payload.length + ((4 - (payload.length % 4)) % 4),
    "="
  );
  const normalized = padded.replaceAll('-', "+").replaceAll('_', "/");
  try {
    const json = Buffer.from(normalized, "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const normalizeScopes = (value: unknown) => {
  if (typeof value === "string") {
    return value.split(" ").filter(Boolean);
  }
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value;
  }
  return [] as string[];
};

const missingKeys = [
  ["TEST_GOOGLE_REFRESH_TOKEN", env.TEST_GOOGLE_REFRESH_TOKEN],
  ["TEST_MS_REFRESH_TOKEN", env.TEST_MS_REFRESH_TOKEN],
  ["GOOGLE_OAUTH_CLIENT_ID", env.GOOGLE_OAUTH_CLIENT_ID],
  ["GOOGLE_OAUTH_CLIENT_SECRET", env.GOOGLE_OAUTH_CLIENT_SECRET],
  ["MICROSOFT_OAUTH_CLIENT_ID", env.MICROSOFT_OAUTH_CLIENT_ID],
  ["MICROSOFT_OAUTH_CLIENT_SECRET", env.MICROSOFT_OAUTH_CLIENT_SECRET],
  ["MICROSOFT_TENANT", env.MICROSOFT_TENANT],
  ["GOOGLE_HD_DOMAIN", env.GOOGLE_HD_DOMAIN],
].filter(([, value]) => !value);
if (missingKeys.length > 0) {
  throw new Error(
    `E2E requires ${missingKeys.map(([key]) => key).join(", ")} in .env.local`
  );
}

const { googleToken, microsoftToken } = await getBearerTokens(true);

if (googleToken?.accessToken) {
  const tokenInfoUrl = ApiEndpoint.GoogleAuth.TokenInfo;
  const googleAccessToken = googleToken.accessToken;
  const googleResponse = await fetchWithTimeout(
    `${tokenInfoUrl}?access_token=${encodeURIComponent(googleAccessToken)}`,
    { method: "GET" }
  );
  if (!googleResponse.ok) {
    const details = await googleResponse.text();
    throw new Error(`Google tokeninfo failed: ${details}`);
  }
  const googleTokenInfo = await googleResponse.json();
  const tokenEmail =
    typeof googleTokenInfo.email === "string" ? googleTokenInfo.email : "";
  const tokenHd =
    typeof googleTokenInfo.hd === "string" ? googleTokenInfo.hd : "";
  const tokenAud =
    typeof googleTokenInfo.aud === "string" ? googleTokenInfo.aud : "";
  const expectedGoogleDomain =
    normalizeEnvValue(env.GOOGLE_HD_DOMAIN) ||
    normalizeEnvValue(env.TEST_DOMAIN) ||
    "test.example.com";
  console.warn(`Google tokeninfo email: ${tokenEmail || "(none)"}`);
  console.warn(`Google tokeninfo hd: ${tokenHd || "(none)"}`);
  console.warn(`Google tokeninfo aud: ${tokenAud || "(none)"}`);

  if (!tokenHd) {
    console.warn(
      "Google token has no hd claim; proceeding but Admin SDK may fail if not a Workspace admin token."
    );
  } else if (expectedGoogleDomain && tokenHd !== expectedGoogleDomain) {
    throw new Error(
      `Google token domain mismatch: expected ${expectedGoogleDomain}, got ${tokenHd}. Re-run bun run tokens:generate with the correct Workspace admin account.`
    );
  }

  const googleScopes = normalizeScopes(googleTokenInfo.scope);
  const missingGoogleScopes = REQUIRED_GOOGLE_SCOPES.filter(
    (scope) => !googleScopes.includes(scope)
  );
  if (missingGoogleScopes.length > 0) {
    throw new Error(
      `Google token missing scopes: ${missingGoogleScopes.join(", ")}`
    );
  }

  const microsoftAccessToken = microsoftToken?.accessToken ?? "";
  const microsoftPayload = decodeJwtPayload(microsoftAccessToken);

  const microsoftUpn =
    typeof microsoftPayload?.preferred_username === "string"
      ? microsoftPayload.preferred_username
      : "";
  const microsoftTenantId =
    typeof microsoftPayload?.tid === "string" ? microsoftPayload.tid : "";
  const expectedMsTenant = normalizeEnvValue(env.MICROSOFT_TENANT);
  console.warn(`Microsoft token subject: ${microsoftUpn || "(none)"}`);

  if (
    microsoftUpn &&
    expectedMsTenant &&
    !microsoftUpn.toLowerCase().endsWith(`@${expectedMsTenant.toLowerCase()}`)
  ) {
    throw new Error(
      `Microsoft token user ${microsoftUpn} does not match tenant/domain ${expectedMsTenant}. Re-run bun run tokens:generate with the correct tenant account.`
    );
  }

  if (microsoftTenantId === "9188040d-6c67-4c5b-b112-36a304b66dad") {
    throw new Error(
      "Microsoft token is from a personal (MSA) account. Use an Entra ID organizational account and re-run bun run tokens:generate."
    );
  }

  const microsoftResponse = await fetchWithTimeout(ApiEndpoint.Microsoft.Me, {
    headers: { Authorization: `Bearer ${microsoftAccessToken}` },
  });
  if (!microsoftResponse.ok) {
    const details = await microsoftResponse.text();
    throw new Error(`Microsoft token validation failed: ${details}`);
  }
  const microsoftScopes = normalizeScopes(microsoftPayload?.scp);
  const missingMicrosoftScopes = REQUIRED_MICROSOFT_SCOPES.filter(
    (scope) => !microsoftScopes.includes(scope)
  );
  if (missingMicrosoftScopes.length > 0) {
    throw new Error(
      `Microsoft token missing scopes: ${missingMicrosoftScopes.join(", ")}`
    );
  }

  if (!(googleToken && microsoftToken)) {
    throw new Error("Failed to refresh required tokens for tests.");
  }
}
