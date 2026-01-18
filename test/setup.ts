import "tsconfig-paths/register";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { ApiEndpoint } from "@/constants";

const ENV_LINE_REGEX = /^([^=]+)=(.*)$/;
const STRIP_QUOTES_REGEX = /^['"]|['"]$/g;
const TEST_ENV_FETCH_TIMEOUT_MS = 5000;

const parseEnvLine = (line: string) => {
  const match = line.match(ENV_LINE_REGEX);
  if (!match) {
    return null;
  }
  const key = match[1].trim();
  const rawValue = match[2]?.trim() ?? "";
  const unquotedValue = rawValue.replace(STRIP_QUOTES_REGEX, "");
  return { key, value: unquotedValue };
};

const applyEnvFile = () => {
  try {
    const envTest = readFileSync(resolve(process.cwd(), ".env.test"), "utf8");
    for (const line of envTest.split("\n")) {
      if (!line.trim() || line.trim().startsWith("#")) {
        continue;
      }
      const parsed = parseEnvLine(line);
      if (!parsed) {
        continue;
      }
      if (!process.env[parsed.key]) {
        process.env[parsed.key] = parsed.value;
      }
    }
  } catch {
    // ignore
  }
};

applyEnvFile();
const { testEnv } = await import("@/env.test");

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

const parseRefreshResponse = (data: unknown, refreshToken: string) => {
  if (!isRecord(data)) {
    return null;
  }
  const accessToken = data.access_token;
  const expiresIn = data.expires_in;
  const scope = data.scope;
  const nextRefreshToken = data.refresh_token;
  if (typeof accessToken !== "string" || typeof expiresIn !== "number") {
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
    expiresAt: Date.now() + expiresIn * 1000,
    scope: scopeList,
  };
};

const refreshToken = async (provider: "google" | "microsoft") => {
  const refreshTokenEnv =
    provider === "google"
      ? testEnv.TEST_GOOGLE_REFRESH_TOKEN
      : testEnv.TEST_MS_REFRESH_TOKEN;
  const tokenUrl =
    provider === "google"
      ? ApiEndpoint.GoogleAuth.Token
      : ApiEndpoint.MicrosoftAuth.Token;
  const clientId =
    provider === "google"
      ? testEnv.GOOGLE_OAUTH_CLIENT_ID
      : testEnv.MICROSOFT_OAUTH_CLIENT_ID;
  const clientSecret =
    provider === "google"
      ? testEnv.GOOGLE_OAUTH_CLIENT_SECRET
      : testEnv.MICROSOFT_OAUTH_CLIENT_SECRET;
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
    return null;
  }
  const data = await response.json();
  return parseRefreshResponse(data, refreshTokenEnv);
};

const ensureBearerToken = async (
  provider: "google" | "microsoft",
  envKey: "TEST_GOOGLE_BEARER_TOKEN" | "TEST_MS_BEARER_TOKEN"
) => {
  if (process.env[envKey]) {
    return;
  }
  try {
    const token = await refreshToken(provider);
    if (!token) {
      return;
    }
    process.env[envKey] = token.accessToken;
  } catch {
    // ignore refresh errors
  }
};

process.env.TEST_DOMAIN = testEnv.TEST_DOMAIN;

await ensureBearerToken("google", "TEST_GOOGLE_BEARER_TOKEN");
await ensureBearerToken("microsoft", "TEST_MS_BEARER_TOKEN");
