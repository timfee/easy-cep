import { type NextRequest, NextResponse } from "next/server";
import { clearChunkedCookie } from "@/lib/auth";

/**
 * Allow GET requests for convenience (e.g. direct link clicks) to sign out.
 */
export function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> }
) {
  return POST(request, context);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const cookieName = `${provider}_token`;
  const baseUrl = request.nextUrl.origin;
  const response = NextResponse.redirect(`${baseUrl}/`);
  await clearChunkedCookie(response, cookieName);
  return response;
}
