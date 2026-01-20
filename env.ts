import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const runtimeEnv = {
  NODE_ENV: process.env.NODE_ENV,
  AUTH_SECRET: process.env.AUTH_SECRET,
  GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  MICROSOFT_OAUTH_CLIENT_ID: process.env.MICROSOFT_OAUTH_CLIENT_ID,
  MICROSOFT_OAUTH_CLIENT_SECRET: process.env.MICROSOFT_OAUTH_CLIENT_SECRET,
  MICROSOFT_TENANT: process.env.MICROSOFT_TENANT,
  GOOGLE_HD_DOMAIN: process.env.GOOGLE_HD_DOMAIN,
  GOOGLE_IMPERSONATED_ADMIN_EMAIL: process.env.GOOGLE_IMPERSONATED_ADMIN_EMAIL,
  GOOGLE_SERVICE_ACCOUNT_FILE: process.env.GOOGLE_SERVICE_ACCOUNT_FILE,
  GOOGLE_SERVICE_ACCOUNT_JSON: process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
  TEST_DOMAIN: process.env.TEST_DOMAIN,
  TEST_GOOGLE_BEARER_TOKEN: process.env.TEST_GOOGLE_BEARER_TOKEN,
  TEST_GOOGLE_REFRESH_TOKEN: process.env.TEST_GOOGLE_REFRESH_TOKEN,
  TEST_MS_BEARER_TOKEN: process.env.TEST_MS_BEARER_TOKEN,
  TEST_MS_REFRESH_TOKEN: process.env.TEST_MS_REFRESH_TOKEN,
  ALLOW_INFO_PURGE: process.env.ALLOW_INFO_PURGE,
};

export const env = createEnv({
  skipValidation: process.env.NODE_ENV === "test",
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    AUTH_SECRET: z.string(),
    GOOGLE_OAUTH_CLIENT_ID: z.string(),
    GOOGLE_OAUTH_CLIENT_SECRET: z.string(),
    MICROSOFT_OAUTH_CLIENT_ID: z.string(),
    MICROSOFT_OAUTH_CLIENT_SECRET: z.string(),
    MICROSOFT_TENANT: z.string().optional(),
    GOOGLE_HD_DOMAIN: z.string().optional(),
    GOOGLE_IMPERSONATED_ADMIN_EMAIL: z.string().optional(),
    GOOGLE_SERVICE_ACCOUNT_FILE: z.string().optional(),
    GOOGLE_SERVICE_ACCOUNT_JSON: z.string().optional(),
    TEST_DOMAIN: z.string().optional(),
    TEST_GOOGLE_BEARER_TOKEN: z.string().optional(),
    TEST_GOOGLE_REFRESH_TOKEN: z.string().optional(),
    TEST_MS_BEARER_TOKEN: z.string().optional(),
    TEST_MS_REFRESH_TOKEN: z.string().optional(),
  },
  client: {},
  shared: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    ALLOW_INFO_PURGE: z
      .preprocess((value) => {
        if (value === "true") {
          return true;
        }
        if (value === "false") {
          return false;
        }
        return value;
      }, z.boolean())
      .default(true),
  },
  runtimeEnv,
});
