import { NextResponse } from "next/server";

import { ApiEndpoint, PROVIDERS } from "@/constants";
import { refreshTokenIfNeeded } from "@/lib/auth";

const GOOGLE_REQUIRED_SCOPE =
  "https://www.googleapis.com/auth/admin.directory.user";

/**
 * Verify provider tokens against their APIs.
 */
export async function GET() {
  const googleToken = await refreshTokenIfNeeded(PROVIDERS.GOOGLE);
  const msToken = await refreshTokenIfNeeded(PROVIDERS.MICROSOFT);
  const result = { google: { valid: false }, microsoft: { valid: false } };
  let needsReauth = false;

  if (googleToken?.accessToken) {
    try {
      const res = await fetch(
        `${ApiEndpoint.GoogleAuth.TokenInfo}?access_token=${encodeURIComponent(
          googleToken.accessToken
        )}`
      );
      const data = await res.json();
      const scope = typeof data.scope === "string" ? data.scope : "";
      result.google.valid = res.ok && scope.includes(GOOGLE_REQUIRED_SCOPE);
      if (!result.google.valid) {
        needsReauth = true;
      }
    } catch {
      needsReauth = true;
      result.google.valid = false;
    }
  } else {
    needsReauth = true;
  }

  if (msToken?.accessToken) {
    try {
      const res = await fetch(ApiEndpoint.Microsoft.Me, {
        headers: { Authorization: `Bearer ${msToken.accessToken}` },
      });
      result.microsoft.valid = res.ok;
      if (!result.microsoft.valid) {
        needsReauth = true;
      }
    } catch {
      needsReauth = true;
      result.microsoft.valid = false;
    }
  } else {
    needsReauth = true;
  }

  return NextResponse.json(result, { status: needsReauth ? 401 : 200 });
}
