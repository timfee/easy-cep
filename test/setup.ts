import "tsconfig-paths/register";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ENV_LINE_REGEX = /^([^=]+)=(.*)$/;
const STRIP_QUOTES_REGEX = /^['"]|['"]$/g;

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

if (!process.env.TEST_DOMAIN) {
  process.env.TEST_DOMAIN = "test.example.com";
}

// Provide defaults for required environment variables
process.env.AUTH_SECRET ??= "test-secret";
process.env.GOOGLE_OAUTH_CLIENT_ID ??= "test-google-client-id";
process.env.GOOGLE_OAUTH_CLIENT_SECRET ??= "test-google-client-secret";
process.env.MICROSOFT_OAUTH_CLIENT_ID ??= "test-microsoft-client-id";
process.env.MICROSOFT_OAUTH_CLIENT_SECRET ??= "test-microsoft-client-secret";
