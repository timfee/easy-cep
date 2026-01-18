import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const testEnv = createEnv({
  server: {
    AUTH_SECRET: z.string().optional(),
    GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
    GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
    MICROSOFT_OAUTH_CLIENT_ID: z.string().optional(),
    MICROSOFT_OAUTH_CLIENT_SECRET: z.string().optional(),
    TEST_GOOGLE_REFRESH_TOKEN: z.string().optional(),
    TEST_MS_REFRESH_TOKEN: z.string().optional(),
    MICROSOFT_TENANT: z.string().optional(),
    GOOGLE_HD_DOMAIN: z.string().optional(),
    TEST_DOMAIN: z.string().default("test.example.com"),
  },
  runtimeEnv: {
    AUTH_SECRET: process.env.AUTH_SECRET,
    GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    MICROSOFT_OAUTH_CLIENT_ID: process.env.MICROSOFT_OAUTH_CLIENT_ID,
    MICROSOFT_OAUTH_CLIENT_SECRET: process.env.MICROSOFT_OAUTH_CLIENT_SECRET,
    TEST_GOOGLE_REFRESH_TOKEN: process.env.TEST_GOOGLE_REFRESH_TOKEN,
    TEST_MS_REFRESH_TOKEN: process.env.TEST_MS_REFRESH_TOKEN,
    MICROSOFT_TENANT: process.env.MICROSOFT_TENANT,
    GOOGLE_HD_DOMAIN: process.env.GOOGLE_HD_DOMAIN,
    TEST_DOMAIN: process.env.TEST_DOMAIN,
  },
});
