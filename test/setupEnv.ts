import "tsconfig-paths/register";

import { existsSync, readFileSync } from "fs";
import { fetch, ProxyAgent, setGlobalDispatcher } from "undici";

if (process.env.USE_UNDICI_PROXY !== "false") {
  const proxy = process.env.https_proxy || process.env.http_proxy;
  if (proxy) {
    setGlobalDispatcher(new ProxyAgent({ uri: proxy }));
  }
  (globalThis as any).fetch = fetch as unknown as typeof globalThis.fetch;
}

if (
  !process.env.TEST_GOOGLE_BEARER_TOKEN
  && existsSync("./google_bearer.token")
) {
  process.env.TEST_GOOGLE_BEARER_TOKEN = readFileSync(
    "./google_bearer.token",
    "utf8"
  ).trim();
}

if (
  !process.env.TEST_MS_BEARER_TOKEN
  && existsSync("./microsoft_bearer.token")
) {
  process.env.TEST_MS_BEARER_TOKEN = readFileSync(
    "./microsoft_bearer.token",
    "utf8"
  ).trim();
}

if (!process.env.TEST_DOMAIN) {
  process.env.TEST_DOMAIN = "test.example.com";
}

// Provide defaults for required environment variables
process.env.AUTH_SECRET ??= "test-secret";
process.env.GOOGLE_OAUTH_CLIENT_ID ??= "test-google-client-id";
process.env.GOOGLE_OAUTH_CLIENT_SECRET ??= "test-google-client-secret";
process.env.MICROSOFT_OAUTH_CLIENT_ID ??= "test-microsoft-client-id";
process.env.MICROSOFT_OAUTH_CLIENT_SECRET ??= "test-microsoft-client-secret";
