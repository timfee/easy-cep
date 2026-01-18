import "tsconfig-paths/register";

import { ApiEndpoint } from "@/constants";
import { testEnv } from "@/env.test";

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const stripQuotes = (value: string) => value.replace(/^['"]|['"]$/g, "");

const normalizeEnvValue = (value: string | undefined) =>
  value ? stripQuotes(value.trim()) : "";

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
  const normalized = padded.replace(/-/g, "+").replace(/_/g, "/");
  try {
    const json = Buffer.from(normalized, "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const parseRefreshResponse = (data: unknown, refreshToken: string) => {
  if (!isRecord(data)) {
    return null;
  }
  const accessToken = data.access_token;
  const expiresIn = data.expires_in;
  const scope = data.scope;
  const nextRefreshToken = data.refresh_token;
  const expiresInValue =
    typeof expiresIn === "string" ? Number(expiresIn) : expiresIn;
  if (
    typeof accessToken !== "string" ||
    typeof expiresInValue !== "number" ||
    Number.isNaN(expiresInValue)
  ) {
    return null;
  }
  const scopeList =
    typeof scope === "string" ? scope.split(" ").filter(Boolean) : [];
  return {
    accessToken,
    refreshToken:
      typeof nextRefreshToken === "string" && nextRefreshToken.length > 0
        ? nextRefreshToken
        : refreshToken,
    expiresAt: Date.now() + expiresInValue * 1000,
    scope: scopeList,
  };
};

const REQUIRED_GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/admin.directory.domain",
  "https://www.googleapis.com/auth/admin.directory.orgunit",
  "https://www.googleapis.com/auth/admin.directory.user",
  "https://www.googleapis.com/auth/admin.directory.rolemanagement",
  "https://www.googleapis.com/auth/cloud-identity.inboundsso",
];

const REQUIRED_MICROSOFT_SCOPES = [
  "Directory.Read.All",
  "Application.ReadWrite.All",
  "AppRoleAssignment.ReadWrite.All",
  "Policy.ReadWrite.ApplicationConfiguration",
];

const normalizeScopes = (value: unknown) => {
  if (typeof value === "string") {
    return value.split(" ").filter(Boolean);
  }
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value;
  }
  return [] as string[];
};

const refreshToken = async (
  provider: "google" | "microsoft",
  requireToken: boolean
) => {
  const refreshTokenEnv =
    provider === "google"
      ? normalizeEnvValue(testEnv.TEST_GOOGLE_REFRESH_TOKEN)
      : normalizeEnvValue(testEnv.TEST_MS_REFRESH_TOKEN);
  const clientId =
    provider === "google"
      ? normalizeEnvValue(testEnv.GOOGLE_OAUTH_CLIENT_ID)
      : normalizeEnvValue(testEnv.MICROSOFT_OAUTH_CLIENT_ID);
  const clientSecret =
    provider === "google"
      ? normalizeEnvValue(testEnv.GOOGLE_OAUTH_CLIENT_SECRET)
      : normalizeEnvValue(testEnv.MICROSOFT_OAUTH_CLIENT_SECRET);
  if (!(refreshTokenEnv && clientId && clientSecret)) {
    if (requireToken) {
      throw new Error(`Missing refresh flow credentials for ${provider}.`);
    }
    return null;
  }
  const tokenUrl =
    provider === "google"
      ? ApiEndpoint.GoogleAuth.Token
      : ApiEndpoint.MicrosoftAuth.Token(
          normalizeEnvValue(testEnv.MICROSOFT_TENANT) || "organizations"
        );
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshTokenEnv,
    grant_type: "refresh_token",
  });
  const response = await fetchWithTimeout(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!response.ok) {
    const error = await response.text();
    if (requireToken) {
      throw new Error(
        `Failed to refresh ${provider} token: ${response.status} ${error}`
      );
    }
    return null;
  }
  const data = await response.json();
  const parsed = parseRefreshResponse(data, refreshTokenEnv);
  if (!parsed && requireToken) {
    throw new Error(`Failed to parse ${provider} refresh response.`);
  }
  return parsed;
};

const ensureBearerToken = async (
  provider: "google" | "microsoft",
  envKey: "TEST_GOOGLE_BEARER_TOKEN" | "TEST_MS_BEARER_TOKEN",
  forceRefresh: boolean
) => {
  const token = await refreshToken(provider, true);
  if (!token) {
    return null;
  }
  process.env[envKey] = token.accessToken;
  return token;
};

process.env.TEST_DOMAIN = testEnv.TEST_DOMAIN;

if (process.env.RUN_E2E === "1") {
  const missingKeys = [
    ["TEST_GOOGLE_REFRESH_TOKEN", testEnv.TEST_GOOGLE_REFRESH_TOKEN],
    ["TEST_MS_REFRESH_TOKEN", testEnv.TEST_MS_REFRESH_TOKEN],
    ["GOOGLE_OAUTH_CLIENT_ID", testEnv.GOOGLE_OAUTH_CLIENT_ID],
    ["GOOGLE_OAUTH_CLIENT_SECRET", testEnv.GOOGLE_OAUTH_CLIENT_SECRET],
    ["MICROSOFT_OAUTH_CLIENT_ID", testEnv.MICROSOFT_OAUTH_CLIENT_ID],
    ["MICROSOFT_OAUTH_CLIENT_SECRET", testEnv.MICROSOFT_OAUTH_CLIENT_SECRET],
    ["MICROSOFT_TENANT", testEnv.MICROSOFT_TENANT],
    ["GOOGLE_HD_DOMAIN", testEnv.GOOGLE_HD_DOMAIN],
  ].filter(([, value]) => !value);
  if (missingKeys.length > 0) {
    throw new Error(
      `RUN_E2E=1 requires ${missingKeys
        .map(([key]) => key)
        .join(", ")} in .env.test`
    );
  }
}

const forceRefresh = process.env.RUN_E2E === "1";
const googleToken = await ensureBearerToken(
  "google",
  "TEST_GOOGLE_BEARER_TOKEN",
  forceRefresh
);
const microsoftToken = await ensureBearerToken(
  "microsoft",
  "TEST_MS_BEARER_TOKEN",
  forceRefresh
);

if (forceRefresh) {
  const tokenInfoUrl = ApiEndpoint.GoogleAuth.TokenInfo;
  const googleAccessToken = process.env.TEST_GOOGLE_BEARER_TOKEN ?? "";
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
    normalizeEnvValue(testEnv.GOOGLE_HD_DOMAIN) ||
    normalizeEnvValue(testEnv.TEST_DOMAIN);
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

  const microsoftAccessToken = process.env.TEST_MS_BEARER_TOKEN ?? "";
  const microsoftPayload = decodeJwtPayload(microsoftAccessToken);
  if (!microsoftPayload) {
    console.warn(
      "Microsoft token is not a JWT. Proceeding without tenant/UPN validation."
    );
  }
  const microsoftUpn =
    typeof microsoftPayload?.preferred_username === "string"
      ? microsoftPayload.preferred_username
      : "";
  const microsoftTenantId =
    typeof microsoftPayload?.tid === "string" ? microsoftPayload.tid : "";
  const expectedMsTenant = normalizeEnvValue(testEnv.MICROSOFT_TENANT);
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

const googleTokenInfo = await googleResponse.json();
const tokenEmail =
  typeof googleTokenInfo.email === "string" ? googleTokenInfo.email : "";
const tokenHd =
  typeof googleTokenInfo.hd === "string" ? googleTokenInfo.hd : "";
const tokenAud =
  typeof googleTokenInfo.aud === "string" ? googleTokenInfo.aud : "";
const expectedGoogleDomain =
  normalizeEnvValue(testEnv.GOOGLE_HD_DOMAIN) ||
  normalizeEnvValue(testEnv.TEST_DOMAIN);
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
if (
  expectedGoogleDomain &&
  tokenEmail &&
  !tokenEmail.toLowerCase().endsWith(`@${expectedGoogleDomain.toLowerCase()}`)
) {
  throw new Error(
    `Google token user ${tokenEmail} does not belong to ${expectedGoogleDomain}. Use a Workspace super admin from that domain.`
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

const microsoftAccessToken = process.env.TEST_MS_BEARER_TOKEN ?? "";
const microsoftPayload = decodeJwtPayload(microsoftAccessToken);
if (!microsoftPayload) {
  throw new Error(
    "Microsoft token is not a JWT. Re-run bun run tokens:generate with an organizational account."
  );
}
const microsoftUpn =
  typeof microsoftPayload.preferred_username === "string"
    ? microsoftPayload.preferred_username
    : "";
const microsoftTenantId =
  typeof microsoftPayload.tid === "string" ? microsoftPayload.tid : "";
const expectedMsTenant = normalizeEnvValue(testEnv.MICROSOFT_TENANT);
console.warn(`Microsoft token subject: ${microsoftUpn || "(none)"}`);

if (!microsoftUpn.includes("@")) {
  throw new Error(
    "Microsoft token is not an organizational account (missing UPN). Re-run bun run tokens:generate with a work/school account."
  );
}
if (microsoftTenantId === "9188040d-6c67-4c5b-b112-36a304b66dad") {
  throw new Error(
    "Microsoft token is from a personal (MSA) account. Use an Entra ID organizational account and re-run bun run tokens:generate."
  );
}
if (
  expectedMsTenant &&
  !microsoftUpn.toLowerCase().endsWith(`@${expectedMsTenant.toLowerCase()}`)
) {
  throw new Error(
    `Microsoft token user ${microsoftUpn} does not match tenant/domain ${expectedMsTenant}. Re-run bun run tokens:generate with the correct tenant account.`
  );
}

const microsoftResponse = await fetchWithTimeout(ApiEndpoint.Microsoft.Me, {
  headers: { Authorization: `Bearer ${microsoftAccessToken}` },
});
if (!microsoftResponse.ok) {
  const details = await microsoftResponse.text();
  throw new Error(`Microsoft token validation failed: ${details}`);
}
const microsoftScopes = normalizeScopes(microsoftPayload.scp);
const missingMicrosoftScopes = REQUIRED_MICROSOFT_SCOPES.filter(
  (scope) => !microsoftScopes.includes(scope)
);
if (missingMicrosoftScopes.length > 0) {
  throw new Error(
    `Microsoft token missing scopes: ${missingMicrosoftScopes.join(", ")}`
  );
}
}
