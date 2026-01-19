import { env } from "@/env";

const ensureToken = (token: string | undefined) => {
  if (!token) {
    return null;
  }

  return {
    accessToken: token,
    expiresAt: Date.now() + 60 * 60 * 1000,
    scope: [],
  };
};

const readGoogleToken = () => env.TEST_GOOGLE_BEARER_TOKEN;
const readMicrosoftToken = () => env.TEST_MS_BEARER_TOKEN;

export const googleBearerToken = ensureToken(readGoogleToken());
export const microsoftBearerToken = ensureToken(readMicrosoftToken());
