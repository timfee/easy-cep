import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { OAUTH_STATE_COOKIE_NAME, PROVIDERS } from "@/constants";
import {
  clearChunkedCookie,
  encrypt,
  generateAuthUrl,
  generateState,
  setChunkedCookie,
} from "@/lib/auth";

/**
 * Start the OAuth flow for a supported provider.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  if (provider !== PROVIDERS.GOOGLE && provider !== PROVIDERS.MICROSOFT) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const state = generateState();
  const baseUrl = request.nextUrl.origin;
  const authUrl = generateAuthUrl(provider, state, baseUrl);

  const response = NextResponse.redirect(authUrl);
  const data = { provider, state, timestamp: Date.now() };
  const encrypted = encrypt(JSON.stringify(data));
  await clearChunkedCookie(response, OAUTH_STATE_COOKIE_NAME);
  await setChunkedCookie(response, OAUTH_STATE_COOKIE_NAME, encrypted);
  return response;
}
