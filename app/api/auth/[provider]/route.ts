import { OAUTH_STATE_COOKIE_NAME, PROVIDERS, Provider } from "@/constants";
import {
  clearChunkedCookie,
  encrypt,
  generateAuthUrl,
  generateState,
  setChunkedCookie
} from "@/lib/auth";

import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const provider = url.pathname.split("/").pop() as Provider;

  if (provider !== PROVIDERS.GOOGLE && provider !== PROVIDERS.MICROSOFT) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const state = generateState();
  const baseUrl = url.protocol + "//" + url.host;
  const authUrl = generateAuthUrl(provider, state, baseUrl);

  const response = NextResponse.redirect(authUrl);
  const data = { state, provider, timestamp: Date.now() };
  const encrypted = encrypt(JSON.stringify(data));
  await clearChunkedCookie(response, OAUTH_STATE_COOKIE_NAME);
  await setChunkedCookie(response, OAUTH_STATE_COOKIE_NAME, encrypted);
  return response;
}
