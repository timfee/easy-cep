import { Provider } from "@/constants";
import { clearChunkedCookie } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

/**
 * Allow GET requests for convenience (e.g. direct link clicks) to sign out.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: Provider }> }
) {
  return POST(request, context);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: Provider }> }
) {
  const { provider } = await params;
  const cookieName = `${provider}_token`;
  const baseUrl = request.nextUrl.origin;
  const response = NextResponse.redirect(`${baseUrl}/`);
  await clearChunkedCookie(response, cookieName);
  return response;
}
