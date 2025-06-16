import { ApiEndpoint, OAuthConfig, OAuthScope } from "@/constants";
import { NextResponse } from "next/server";

export async function GET() {
  const params = new URLSearchParams({
    client_id: OAuthConfig.Microsoft.clientId,
    response_type: "code",
    redirect_uri: OAuthConfig.Microsoft.redirectUri,
    scope: OAuthScope.Microsoft
  });
  return NextResponse.redirect(
    `${ApiEndpoint.MicrosoftAuth.Authorize}?${params.toString()}`
  );
}
