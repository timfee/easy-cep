import { Provider } from "@/constants";
import { exchangeCodeForToken, setToken, validateOAuthState } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: Provider }> }
) {
  const { provider } = await params;
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const baseUrl = request.nextUrl.origin;

  if (error) {
    console.error(error);
    return NextResponse.redirect(`${baseUrl}/?error=${error}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/?error=missing_params`);
  }

  const valid = await validateOAuthState(state, provider);
  if (!valid) {
    return NextResponse.redirect(`${baseUrl}/?error=invalid_state`);
  }

  try {
    const token = await exchangeCodeForToken(provider, code, baseUrl);
    const response = NextResponse.redirect(`${baseUrl}/`);
    await setToken(response, provider, token);
    return response;
  } catch (err) {
    console.error(err);
    return NextResponse.redirect(`${baseUrl}/?error=token_exchange_failed`);
  }
}
