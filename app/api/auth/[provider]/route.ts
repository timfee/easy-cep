import { OAUTH_STATE_COOKIE_NAME, PROVIDERS, Provider } from "@/constants";
import { env } from "@/env";
import { encrypt, generateAuthUrl, generateState } from "@/lib/auth";
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

  const isProduction = env.NODE_ENV === "production";
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600
  };

  let cookieString = `${OAUTH_STATE_COOKIE_NAME}=${encrypted}`;
  cookieString += `; Path=${cookieOptions.path}`;
  cookieString += `; Max-Age=${cookieOptions.maxAge}`;
  cookieString += `; SameSite=${cookieOptions.sameSite}`;
  if (cookieOptions.httpOnly) cookieString += `; HttpOnly`;
  if (cookieOptions.secure) cookieString += `; Secure`;

  response.headers.append("Set-Cookie", cookieString);

  return response;
}
