import { PROVIDERS } from "@/constants";
import { getToken } from "@/lib/auth/tokens";
import { NextResponse } from "next/server";

export async function GET() {
  const google = await getToken(PROVIDERS.GOOGLE);
  const microsoft = await getToken(PROVIDERS.MICROSOFT);
  return NextResponse.json({
    googleAccessToken: google?.accessToken,
    msGraphToken: microsoft?.accessToken
  });
}
