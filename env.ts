import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

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
    RUN_E2E: z.string().optional(),
    SKIP_E2E: z.string().optional(),
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
  runtimeEnv: process.env,
});
