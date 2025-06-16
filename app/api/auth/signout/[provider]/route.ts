import { Provider } from "@/constants";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const provider = url.pathname.split("/").pop() as Provider;
  const cookieName = `${provider}_token`;
  const baseUrl = url.protocol + "//" + url.host;
  const response = NextResponse.redirect(`${baseUrl}/`);
  response.cookies.set({ name: cookieName, value: "", maxAge: 0, path: "/" });
  return response;
}
