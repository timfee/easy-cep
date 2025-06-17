import { Provider } from "@/constants";
import { clearChunkedCookie } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * Allow GET requests for convenience (e.g. direct link clicks) to sign out.
 */
export async function GET(request: Request) {
  return POST(request);
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const provider = url.pathname.split("/").pop() as Provider;
  const cookieName = `${provider}_token`;
  const baseUrl = url.protocol + "//" + url.host;
  const response = NextResponse.redirect(`${baseUrl}/`);
  await clearChunkedCookie(response, cookieName);
  return response;
}
