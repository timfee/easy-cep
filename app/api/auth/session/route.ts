import { PROVIDERS } from "@/constants";
import { refreshTokenIfNeeded } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const googleToken = await refreshTokenIfNeeded(PROVIDERS.GOOGLE);
  const microsoftToken = await refreshTokenIfNeeded(PROVIDERS.MICROSOFT);
  return NextResponse.json({
    googleAccessToken: googleToken?.accessToken,
    googleExpiresAt: googleToken?.expiresAt,
    msGraphToken: microsoftToken?.accessToken,
    msGraphExpiresAt: microsoftToken?.expiresAt
  });
}
