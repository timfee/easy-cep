import { Provider } from "@/constants";
import { exchangeCodeForToken, setToken, validateOAuthState } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const provider = url.pathname.split("/").pop() as Provider;
  const searchParams = url.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const baseUrl = url.protocol + "//" + url.host;

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
    await setToken(provider, token);
    const response = NextResponse.redirect(`${baseUrl}/`);
    return response;
  } catch (err) {
    console.error(err);
    return NextResponse.redirect(`${baseUrl}/?error=token_exchange_failed`);
  }
}
