import { ApiEndpoint, OAuthConfig, OAuthScope } from "@/constants";
import { setChunkedCookie } from "@/lib/chunked-cookies";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "missing_code" }, { status: 400 });
  }

  const params = new URLSearchParams({
    client_id: OAuthConfig.Microsoft.clientId,
    client_secret: OAuthConfig.Microsoft.clientSecret,
    code,
    redirect_uri: OAuthConfig.Microsoft.redirectUri,
    grant_type: "authorization_code",
    scope: OAuthScope.Microsoft
  });

  const tokenRes = await fetch(ApiEndpoint.MicrosoftAuth.Token, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });
  const data = await tokenRes.json();
  if (!tokenRes.ok) {
    return NextResponse.json(data, { status: 400 });
  }

  const response = NextResponse.redirect(new URL("/", request.url));
  await setChunkedCookie(response, "msToken", data.access_token as string);
  return response;
}
