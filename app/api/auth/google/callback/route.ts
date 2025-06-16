import { ApiEndpoint, OAuthConfig } from "@/constants";
import { setChunkedCookie } from "@/lib/chunked-cookies";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "missing_code" }, { status: 400 });
  }

  const params = new URLSearchParams({
    code,
    client_id: OAuthConfig.Google.clientId,
    client_secret: OAuthConfig.Google.clientSecret,
    redirect_uri: OAuthConfig.Google.redirectUri,
    grant_type: "authorization_code"
  });

  const res = await fetch(ApiEndpoint.GoogleAuth.Token, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });
  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json(data, { status: 400 });
  }

  const response = NextResponse.redirect(new URL("/", request.url));
  await setChunkedCookie(response, "googleToken", data.access_token as string);
  return response;
}
