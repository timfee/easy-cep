import { ApiEndpoint, OAuthConfig, OAuthScope } from "@/constants";
import { NextResponse } from "next/server";

export async function GET() {
  const params = new URLSearchParams({
    client_id: OAuthConfig.Google.clientId,
    redirect_uri: OAuthConfig.Google.redirectUri,
    response_type: "code",
    scope: OAuthScope.Google,
    access_type: "offline",
    prompt: "consent"
  });
  return NextResponse.redirect(
    `${ApiEndpoint.GoogleAuth.Authorize}?${params.toString()}`
  );
}
