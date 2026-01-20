import { NextResponse } from "next/server";

import { ApiEndpoint, PROVIDERS } from "@/constants";
import { getChunkedCookie } from "@/lib/auth";

/**
 * Verify provider tokens against their APIs.
 */
export async function GET() {
  const googleToken = await getChunkedCookie(`${PROVIDERS.GOOGLE}_token`);
  const msToken = await getChunkedCookie(`${PROVIDERS.MICROSOFT}_token`);
  const result = { google: { valid: false }, microsoft: { valid: false } };

  if (googleToken) {
    try {
      const res = await fetch(
        `${ApiEndpoint.GoogleAuth.TokenInfo}?access_token=${googleToken}`
      );
      const data = await res.json();
      result.google.valid =
        res.ok && (data.scope || "").includes("admin.directory.user.readonly");
    } catch {
      result.google.valid = false;
    }
  }

  if (msToken) {
    try {
      const res = await fetch(ApiEndpoint.Microsoft.Me, {
        headers: { Authorization: `Bearer ${msToken}` },
      });
      result.microsoft.valid = res.ok;
    } catch {
      result.microsoft.valid = false;
    }
  }

  return NextResponse.json(result);
}
