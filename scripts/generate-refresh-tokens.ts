#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { PROVIDERS, type Provider } from "@/constants";

type ExchangeCodeForToken = typeof import("@/lib/auth").exchangeCodeForToken;
type GenerateAuthUrl = typeof import("@/lib/auth").generateAuthUrl;

const PORT = 3000;
const HOST = "http://localhost:3000";

const ENV_LINE_REGEX = /^([^=]+)=(.*)$/;

const applyEnvFile = (path: string) => {
  try {
    const envFile = readFileSync(path, "utf8");
    for (const line of envFile.split("\n")) {
      const match = line.match(ENV_LINE_REGEX);
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

// These will be resolved when the respective callback is hit
let onGoogleToken: (token: string) => void;
let onMicrosoftToken: (token: string) => void;

const googleAuthPromise = new Promise<string>((resolve) => {
  onGoogleToken = resolve;
});

const microsoftAuthPromise = new Promise<string>((resolve) => {
  onMicrosoftToken = resolve;
});

const requireRefreshToken = (
  token: { refreshToken?: string },
  provider: string
) => {
  if (!token.refreshToken) {
    throw new Error(`Missing refresh token for ${provider}`);
  }
  return token.refreshToken;
};

const server = createServer(async (req, res) => {
  try {
    // Basic URL parsing
    const url = new URL(req.url || "/", HOST);
    let pathname = url.pathname;
    if (pathname.length > 1 && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }

    if (pathname === "/favicon.ico") {
      res.writeHead(404);
      res.end();
      return;
    }

    console.log(`[Server] ${req.method} ${pathname}`);

    // Route handling
    let provider: Provider | null = null;
    if (pathname === `/api/auth/callback/${PROVIDERS.GOOGLE}`) {
      provider = PROVIDERS.GOOGLE;
    } else if (pathname === `/api/auth/callback/${PROVIDERS.MICROSOFT}`) {
      provider = PROVIDERS.MICROSOFT;
    }

    if (!provider) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end(
        `Not Found. Expected callback for google or microsoft. Got: ${pathname}`
      );
      return;
    }

    // Process Callback
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error) {
      console.error(`[${provider}] Error from provider:`, error);
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end(`<h1>Auth Error</h1><p>${error}</p>`);
      return;
    }

    if (!code) {
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end("<h1>Error</h1><p>Missing 'code' parameter.</p>");
      return;
    }

    console.log(`[${provider}] Code received. Exchanging for token...`);

    try {
      const token = await exchangeCodeForToken(provider, code, HOST);

      // Send success response to browser
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(
        `<div style="font-family: system-ui, sans-serif; text-align: center; padding: 2rem;">
          <h1 style="color: green;">Authentication Successful</h1>
          <p>Received token for <strong>${provider}</strong>.</p>
          <p>You can close this tab.</p>
        </div>`
      );

      const refreshToken = requireRefreshToken(token, provider);

      // Resolve the corresponding promise
      if (provider === PROVIDERS.GOOGLE) {
        onGoogleToken(refreshToken);
      } else {
        onMicrosoftToken(refreshToken);
      }
    } catch (exchangeError) {
      console.error(`[${provider}] Token exchange failed:`, exchangeError);
      res.writeHead(500, { "Content-Type": "text/html" });
      res.end(`<h1>Token Exchange Failed</h1><p>${String(exchangeError)}</p>`);
    }
  } catch (err) {
    console.error("[Server] Critical Error:", err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
    }
  }
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
    if (newLines.length > 0 && newLines.at(-1) !== "") {
      newLines.push("");
    }
    newLines.push(`${key}=${value}`);
  }

  await writeFile(envPath, newLines.join("\n"));
  console.log(`✅ Updated ${key} in ${envPath}`);
}

async function main() {
  applyEnvFile(".env.test");
  applyEnvFile(".env.local");
  ensureOAuthEnv();

  console.log("🚀 Starting Refresh Token Generator");

  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  console.log(`📡 Listening on ${HOST}`);

  try {
    // 1. Google Flow
    const googleState = Math.random().toString(36).substring(7);
    const googleUrl = generateAuthUrl(PROVIDERS.GOOGLE, googleState, HOST);

    console.log("\n===========================================");
    console.log(" 1. GOOGLE AUTHENTICATION");
    console.log("===========================================");
    console.log(`\nClick here:\n${googleUrl}\n`);
    console.log("Waiting for Google callback...");

    const googleRefreshToken = await googleAuthPromise;
    await updateEnvFile("TEST_GOOGLE_REFRESH_TOKEN", googleRefreshToken);

    // 2. Microsoft Flow
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
