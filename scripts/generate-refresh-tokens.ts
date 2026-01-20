#!/usr/bin/env bun
import type { ServerResponse } from "node:http";

import { once } from "node:events";
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";

import type { Provider } from "@/constants";

import { PROVIDERS } from "@/constants";
import { env } from "@/env";
import { exchangeCodeForToken, generateAuthUrl } from "@/lib/auth";

const PORT = 3000;
const HOST = "http://localhost:3000";
const ENV_PATH = ".env.local";

const ensureOAuthEnv = () => {
  const requiredKeys = [
    ["AUTH_SECRET", env.AUTH_SECRET],
    ["GOOGLE_OAUTH_CLIENT_ID", env.GOOGLE_OAUTH_CLIENT_ID],
    ["GOOGLE_OAUTH_CLIENT_SECRET", env.GOOGLE_OAUTH_CLIENT_SECRET],
    ["MICROSOFT_OAUTH_CLIENT_ID", env.MICROSOFT_OAUTH_CLIENT_ID],
    ["MICROSOFT_OAUTH_CLIENT_SECRET", env.MICROSOFT_OAUTH_CLIENT_SECRET],
  ] as const;
  const missing = requiredKeys.filter(([, value]) => !value);
  if (missing.length > 0) {
    throw new Error(
      `Missing OAuth env vars required for token generation. Ensure .env.local contains: ${missing
        .map(([key]) => key)
        .join(", ")}`
    );
  }
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
  provider: Provider
) => {
  if (!token.refreshToken) {
    throw new Error(`Missing refresh token for ${provider}`);
  }
  return token.refreshToken;
};

const handleCallback = async (
  provider: Provider,
  code: string,
  res: ServerResponse
) => {
  const token = await exchangeCodeForToken(provider, code, HOST);
  const refreshToken = requireRefreshToken(token, provider);

  sendHtml(
    res,
    200,
    `<div style="font-family: system-ui, sans-serif; text-align: center; padding: 2rem;">
      <h1 style="color: green;">Authentication Successful</h1>
      <p>Received token for <strong>${provider}</strong>.</p>
      <p>You can close this tab.</p>
    </div>`
  );

  return refreshToken;
};

async function updateEnvFile(key: string, value: string) {
  let content = "";
  try {
    content = await readFile(ENV_PATH, "utf8");
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

  await writeFile(ENV_PATH, newLines.join("\n"));
  console.log(`✅ Updated ${key} in ${ENV_PATH}`);
}

const tokenTarget = new EventTarget();

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", HOST);
    const pathname = normalizePathname(url.pathname);

    if (pathname === "/favicon.ico") {
      res.writeHead(404);
      res.end();
      return;
    }

    console.log(`[Server] ${req.method ?? "GET"} ${pathname}`);

    const provider = getProviderFromPath(pathname);
    if (!provider) {
      sendNotFound(res, pathname);
      return;
    }

    const error = url.searchParams.get("error");
    if (error) {
      console.error(`[${provider}] Error from provider:`, error);
      sendHtml(res, 400, `<h1>Auth Error</h1><p>${error}</p>`);
      return;
    }

    const code = url.searchParams.get("code");
    if (!code) {
      sendHtml(res, 400, "<h1>Error</h1><p>Missing 'code' parameter.</p>");
      return;
    }

    console.log(`[${provider}] Code received. Exchanging for token...`);
    try {
      const refreshToken = await handleCallback(provider, code, res);
      tokenTarget.dispatchEvent(
        new CustomEvent<string>(provider, { detail: refreshToken })
      );
    } catch (error) {
      console.error(`[${provider}] Token exchange failed:`, error);
      sendHtml(
        res,
        500,
        `<h1>Token Exchange Failed</h1><p>${String(error)}</p>`
      );
    }
  } catch (error) {
    console.error("[Server] Critical Error:", error);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
    }
  }
});

async function main() {
  ensureOAuthEnv();

  console.log("🚀 Starting Refresh Token Generator");

  server.listen(PORT);
  await once(server, "listening");
  console.log(`📡 Listening on ${HOST}`);

  try {
    const googleState = Math.random().toString(36).slice(7);
    const googleUrl = generateAuthUrl(PROVIDERS.GOOGLE, googleState, HOST);

    console.log("\n===========================================");
    console.log(" 1. GOOGLE AUTHENTICATION");
    console.log("===========================================");
    console.log(`\nClick here:\n${googleUrl}\n`);
    console.log("Waiting for Google callback...");

    const [googleEvent] = await once(tokenTarget, PROVIDERS.GOOGLE);
    const googleRefreshToken = (googleEvent as CustomEvent<string>).detail;
    await updateEnvFile("TEST_GOOGLE_REFRESH_TOKEN", googleRefreshToken);

    const msState = Math.random().toString(36).slice(7);
    const msUrl = generateAuthUrl(PROVIDERS.MICROSOFT, msState, HOST);

    console.log("\n===========================================");
    console.log(" 2. MICROSOFT AUTHENTICATION");
    console.log("===========================================");
    console.log(`\nClick here:\n${msUrl}\n`);
    console.log("Waiting for Microsoft callback...");

    const [msEvent] = await once(tokenTarget, PROVIDERS.MICROSOFT);
    const msRefreshToken = (msEvent as CustomEvent<string>).detail;
    await updateEnvFile("TEST_MS_REFRESH_TOKEN", msRefreshToken);

    console.log("\n✨ All done. Exiting.");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  } finally {
    server.close();
  }
}

if (typeof require !== "undefined" && require.main === module) {
  (async () => {
    try {
      await main();
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    }
  })();
}
