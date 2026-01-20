import { NextResponse } from "next/server";

import { PROVIDERS } from "@/constants";
import { clearChunkedCookie, refreshTokenWithResult } from "@/lib/auth";

/**
 * Return the latest access tokens and expiry timestamps.
 */
export async function GET() {
  const [googleResult, microsoftResult] = await Promise.all([
    refreshTokenWithResult(PROVIDERS.GOOGLE),
    refreshTokenWithResult(PROVIDERS.MICROSOFT),
  ]);

  const response = NextResponse.json({
    googleAccessToken: googleResult.token?.accessToken,
    googleExpiresAt: googleResult.token?.expiresAt,
    msGraphExpiresAt: microsoftResult.token?.expiresAt,
    msGraphToken: microsoftResult.token?.accessToken,
  });

  if (googleResult.status === "reauth") {
    await clearChunkedCookie(response, `${PROVIDERS.GOOGLE}_token`);
  }
  if (microsoftResult.status === "reauth") {
    await clearChunkedCookie(response, `${PROVIDERS.MICROSOFT}_token`);
  }

  return response;
}
