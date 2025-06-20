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
