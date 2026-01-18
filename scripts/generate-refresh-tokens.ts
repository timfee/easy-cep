#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { PROVIDERS, type Provider } from "@/constants";

type ExchangeCodeForToken = typeof import("@/lib/auth").exchangeCodeForToken;
type GenerateAuthUrl = typeof import("@/lib/auth").generateAuthUrl;

type ParsedRequest =
  | { type: "ignore"; pathname: string }
  | { type: "not-found"; pathname: string }
  | {
      type: "error";
      pathname: string;
      provider: Provider;
      error: string;
    }
  | { type: "missing-code"; pathname: string; provider: Provider }
  | { type: "code"; pathname: string; provider: Provider; code: string };

const PORT = 3000;
const HOST = "http://localhost:3000";
const ENV_LINE_REGEX = /^([^=]+)=(.*)$/;

const applyEnvFile = (path: string) => {
  try {
    const envFile = readFileSync(path, "utf8");
    for (const line of envFile.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const match = trimmed.match(ENV_LINE_REGEX);
      if (!match) {
        continue;
      }
      const key = match[1]?.trim();
      const value = match[2]?.trim() ?? "";
      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // ignore missing env files
  }
};

const ensureOAuthEnv = () => {
  const requiredKeys = [
    "AUTH_SECRET",
    "GOOGLE_OAUTH_CLIENT_ID",
    "GOOGLE_OAUTH_CLIENT_SECRET",
    "MICROSOFT_OAUTH_CLIENT_ID",
    "MICROSOFT_OAUTH_CLIENT_SECRET",
  ];
  const missing = requiredKeys.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing OAuth env vars required for token generation: ${missing.join(", ")}`
    );
  }
};

const loadAuthLib = async () => {
  const auth = await import("@/lib/auth");
  return {
    exchangeCodeForToken: auth.exchangeCodeForToken as ExchangeCodeForToken,
    generateAuthUrl: auth.generateAuthUrl as GenerateAuthUrl,
  };
};

const normalizePathname = (pathname: string) =>
  pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;

const getProviderFromPath = (pathname: string) => {
  if (pathname === `/api/auth/callback/${PROVIDERS.GOOGLE}`) {
    return PROVIDERS.GOOGLE;
  }
  if (pathname === `/api/auth/callback/${PROVIDERS.MICROSOFT}`) {
    return PROVIDERS.MICROSOFT;
  }
  return null;
};

const parseRequest = (req: IncomingMessage): ParsedRequest => {
  const url = new URL(req.url ?? "/", HOST);
  const pathname = normalizePathname(url.pathname);
  if (pathname === "/favicon.ico") {
    return { type: "ignore", pathname };
  }
  const provider = getProviderFromPath(pathname);
  if (!provider) {
    return { type: "not-found", pathname };
  }
  const error = url.searchParams.get("error");
  if (error) {
    return { type: "error", pathname, provider, error };
  }
  const code = url.searchParams.get("code");
  if (!code) {
    return { type: "missing-code", pathname, provider };
  }
  return { type: "code", pathname, provider, code };
};

const sendHtml = (res: ServerResponse, status: number, body: string) => {
  res.writeHead(status, { "Content-Type": "text/html" });
  res.end(body);
};

const sendNotFound = (res: ServerResponse, pathname: string) => {
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end(
    `Not Found. Expected callback for google or microsoft. Got: ${pathname}`
  );
};

const requireRefreshToken = (
  token: { refreshToken?: string },
  provider: string
) => {
  if (!token.refreshToken) {
    throw new Error(`Missing refresh token for ${provider}`);
  }
  return token.refreshToken;
};

const handleCallback = async (
  helpers: { exchangeCodeForToken: ExchangeCodeForToken },
  provider: Provider,
  code: string,
  res: ServerResponse,
  onToken: (token: string) => void
) => {
  const token = await helpers.exchangeCodeForToken(provider, code, HOST);
  sendHtml(
    res,
    200,
    `<div style="font-family: system-ui, sans-serif; text-align: center; padding: 2rem;">
      <h1 style="color: green;">Authentication Successful</h1>
      <p>Received token for <strong>${provider}</strong>.</p>
      <p>You can close this tab.</p>
    </div>`
  );
  onToken(requireRefreshToken(token, provider));
};

const createAuthServer = (helpers: {
  exchangeCodeForToken: ExchangeCodeForToken;
}) =>
  createServer(async (req, res) => {
    try {
      const parsed = parseRequest(req);
      if (parsed.type !== "ignore") {
        console.log(`[Server] ${req.method ?? "GET"} ${parsed.pathname}`);
      }

      if (parsed.type === "ignore") {
        res.writeHead(404);
        res.end();
        return;
      }

      if (parsed.type === "not-found") {
        sendNotFound(res, parsed.pathname);
        return;
      }

      if (parsed.type === "error") {
        console.error(
          `[${parsed.provider}] Error from provider:`,
          parsed.error
        );
        sendHtml(res, 400, `<h1>Auth Error</h1><p>${parsed.error}</p>`);
        return;
      }

      if (parsed.type === "missing-code") {
        sendHtml(res, 400, "<h1>Error</h1><p>Missing 'code' parameter.</p>");
        return;
      }

      if (parsed.type !== "code") {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Unsupported request");
        return;
      }

      console.log(
        `[${parsed.provider}] Code received. Exchanging for token...`
      );
      try {
        const onToken =
          parsed.provider === PROVIDERS.GOOGLE
            ? onGoogleToken
            : onMicrosoftToken;
        await handleCallback(
          helpers,
          parsed.provider,
          parsed.code,
          res,
          onToken
        );
      } catch (exchangeError) {
        console.error(
          `[${parsed.provider}] Token exchange failed:`,
          exchangeError
        );
        sendHtml(
          res,
          500,
          `<h1>Token Exchange Failed</h1><p>${String(exchangeError)}</p>`
        );
      }
    } catch (err) {
      console.error("[Server] Critical Error:", err);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error");
      }
    }
  });

// These will be resolved when the respective callback is hit
let onGoogleToken: (token: string) => void;
let onMicrosoftToken: (token: string) => void;

const googleAuthPromise = new Promise<string>((resolve) => {
  onGoogleToken = resolve;
});

const microsoftAuthPromise = new Promise<string>((resolve) => {
  onMicrosoftToken = resolve;
});

async function updateEnvFile(key: string, value: string) {
  const envPath = ".env.test";
  let content = "";
  try {
    content = await readFile(envPath, "utf8");
  } catch {
    // File doesn't exist, start empty
  }

  const lines = content.split("\n");
  let found = false;
  const newLines = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });

  if (!found) {
    const lastLine = newLines.at(-1);
    if (newLines.length > 0 && lastLine !== "") {
      newLines.push("");
    }
    newLines.push(`${key}=${value}`);
  }

  await writeFile(envPath, newLines.join("\n"));
  console.log(`✅ Updated ${key} in ${envPath}`);
}

async function main() {
  applyEnvFile(".env.local");
  applyEnvFile(".env.test");
  ensureOAuthEnv();

  const { exchangeCodeForToken, generateAuthUrl } = await loadAuthLib();
  const server = createAuthServer({ exchangeCodeForToken });

  console.log("🚀 Starting Refresh Token Generator");

  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  console.log(`📡 Listening on ${HOST}`);

  try {
    const googleState = Math.random().toString(36).substring(7);
    const googleUrl = generateAuthUrl(PROVIDERS.GOOGLE, googleState, HOST);

    console.log("\n===========================================");
    console.log(" 1. GOOGLE AUTHENTICATION");
    console.log("===========================================");
    console.log(`\nClick here:\n${googleUrl}\n`);
    console.log("Waiting for Google callback...");

    const googleRefreshToken = await googleAuthPromise;
    await updateEnvFile("TEST_GOOGLE_REFRESH_TOKEN", googleRefreshToken);

    const msState = Math.random().toString(36).substring(7);
    const msUrl = generateAuthUrl(PROVIDERS.MICROSOFT, msState, HOST);

    console.log("\n===========================================");
    console.log(" 2. MICROSOFT AUTHENTICATION");
    console.log("===========================================");
    console.log(`\nClick here:\n${msUrl}\n`);
    console.log("Waiting for Microsoft callback...");

    const msRefreshToken = await microsoftAuthPromise;
    await updateEnvFile("TEST_MS_REFRESH_TOKEN", msRefreshToken);

    console.log("\n✨ All done. Exiting.");
    process.exit(0);
  } catch (err) {
    console.error("\n❌ Script failed:", err);
    process.exit(1);
  } finally {
    server.close();
  }
}

main();
