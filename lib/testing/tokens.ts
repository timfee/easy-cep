import { createSign } from "node:crypto";
import { ApiEndpoint } from "@/constants";
import { env } from "@/env";

export interface BearerToken {
  accessToken: string;
  expiresAt: number;
  scope: string[];
}

const TEST_ENV_FETCH_TIMEOUT_MS = 5000;

export const REQUIRED_GOOGLE_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/admin.directory.domain",
  "https://www.googleapis.com/auth/admin.directory.orgunit",
  "https://www.googleapis.com/auth/admin.directory.user",
  "https://www.googleapis.com/auth/admin.directory.rolemanagement",
  "https://www.googleapis.com/auth/cloud-identity.inboundsso",
  "https://www.googleapis.com/auth/siteverification",
];

export const REQUIRED_MICROSOFT_SCOPES = [
  "Directory.Read.All",
  "Application.ReadWrite.All",
  "AppRoleAssignment.ReadWrite.All",
  "Policy.ReadWrite.ApplicationConfiguration",
];

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

const base64UrlEncode = (input: string | Buffer) => {
  const buffer = typeof input === "string" ? Buffer.from(input) : input;
  return buffer
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
};

const signJwt = (
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  privateKey: string
) => {
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signer = createSign("RSA-SHA256");
  signer.update(data);
  signer.end();

  const signature = signer.sign(privateKey);
  const encodedSignature = base64UrlEncode(signature);

  return `${data}.${encodedSignature}`;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const stripQuotes = (value: string) => value.replace(/^['"]|['"]$/g, "");

export const normalizeEnvValue = (value: string | undefined) =>
  value ? stripQuotes(value.trim()) : "";

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
  } satisfies BearerToken & { refreshToken: string };
};

const getServiceAccountToken = async (): Promise<BearerToken | null> => {
  const saJson = env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const saFile = env.GOOGLE_SERVICE_ACCOUNT_FILE;
  const impersonatedEmail = env.GOOGLE_IMPERSONATED_ADMIN_EMAIL;

  if (!(impersonatedEmail && (saJson || saFile))) {
    return null;
  }

  let creds: { client_email: string; private_key: string; token_uri?: string };
  try {
    if (saJson) {
      creds = JSON.parse(saJson);
    } else {
      const fs = await import("node:fs");
      if (!saFile) {
        return null;
      }
      const content = fs.readFileSync(saFile, "utf8");
      creds = JSON.parse(content);
    }
  } catch (error) {
    console.warn("Failed to parse Google service account credentials:", error);
    return null;
  }

  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: creds.client_email,
    sub: impersonatedEmail,
    aud: creds.token_uri || ApiEndpoint.GoogleAuth.Token,
    exp,
    iat,
    scope: REQUIRED_GOOGLE_SCOPES.join(" "),
  };

  const assertion = signJwt(header, payload, creds.private_key);
  const params = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const response = await fetchWithTimeout(
    creds.token_uri || ApiEndpoint.GoogleAuth.Token,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `Failed to get service account token: ${response.status} ${error}`
    );
  }

  const data = await response.json();
  if (!isRecord(data) || typeof data.access_token !== "string") {
    throw new Error("Invalid service account token response");
  }

  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
    scope: REQUIRED_GOOGLE_SCOPES,
  };
};

const refreshTokenWithClient = async (
  provider: "google" | "microsoft",
  requireToken: boolean
): Promise<(BearerToken & { refreshToken: string }) | null> => {
  const refreshTokenEnv =
    provider === "google"
      ? normalizeEnvValue(env.TEST_GOOGLE_REFRESH_TOKEN)
      : normalizeEnvValue(env.TEST_MS_REFRESH_TOKEN);
  const clientId =
    provider === "google"
      ? normalizeEnvValue(env.GOOGLE_OAUTH_CLIENT_ID)
      : normalizeEnvValue(env.MICROSOFT_OAUTH_CLIENT_ID);
  const clientSecret =
    provider === "google"
      ? normalizeEnvValue(env.GOOGLE_OAUTH_CLIENT_SECRET)
      : normalizeEnvValue(env.MICROSOFT_OAUTH_CLIENT_SECRET);
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
          normalizeEnvValue(env.MICROSOFT_TENANT) || "organizations"
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

  if (provider === "microsoft" && parsed?.accessToken) {
    const parts = parsed.accessToken.split(".");
    if (parts.length !== 3) {
      console.warn(
        "⚠️ Refreshed Microsoft token is NOT a valid JWT (no dots). Graph API will fail."
      );
    }
  }

  return parsed;
};

const ensureBearerToken = async (
  provider: "google" | "microsoft",
  requireToken: boolean
): Promise<BearerToken | null> => {
  if (provider === "google") {
    const saToken = await getServiceAccountToken();
    if (saToken) {
      console.log("✅ Using Google Service Account (Domain-Wide Delegation)");
      return saToken;
    }
  }

  const token = await refreshTokenWithClient(provider, requireToken);
  if (!token) {
    return null;
  }
  return token;
};

let cachedTokens: {
  googleToken: BearerToken | null;
  microsoftToken: BearerToken | null;
} | null = null;

export const getBearerTokens = async (requireToken: boolean) => {
  if (cachedTokens && !requireToken) {
    return cachedTokens;
  }

  const googleToken = await ensureBearerToken("google", requireToken);
  const microsoftToken = await ensureBearerToken("microsoft", requireToken);

  cachedTokens = { googleToken, microsoftToken };
  return cachedTokens;
};
