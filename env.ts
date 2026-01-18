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
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    AUTH_SECRET: process.env.AUTH_SECRET,
    GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    MICROSOFT_OAUTH_CLIENT_ID: process.env.MICROSOFT_OAUTH_CLIENT_ID,
    MICROSOFT_OAUTH_CLIENT_SECRET: process.env.MICROSOFT_OAUTH_CLIENT_SECRET,
    MICROSOFT_TENANT: process.env.MICROSOFT_TENANT,
    GOOGLE_HD_DOMAIN: process.env.GOOGLE_HD_DOMAIN,
    ALLOW_INFO_PURGE: process.env.ALLOW_INFO_PURGE,
  },
});
