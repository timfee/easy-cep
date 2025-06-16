import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const CHUNK_SIZE = 3800;

export async function setChunkedCookie(
  response: NextResponse,
  name: string,
  value: string
) {
  const chunks = Math.ceil(value.length / CHUNK_SIZE);
  for (let i = 0; i < chunks; i++) {
    const chunk = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const cookieName = i === 0 ? name : `${name}-${i}`;
    response.cookies.set(cookieName, chunk, { httpOnly: true, path: "/" });
  }
}

export async function getChunkedCookie(
  name: string
): Promise<string | undefined> {
  const store = await cookies();
  const first = store.get(name);
  if (!first) {
    return undefined;
  }
  let value = first.value;
  for (let i = 1; ; i++) {
    const part = store.get(`${name}-${i}`);
    if (!part) {
      break;
    }
    value += part.value;
  }
  return value;
}

export async function clearChunkedCookie(response: NextResponse, name: string) {
  const store = await cookies();
  if (store.get(name)) {
    response.cookies.delete(name);
  }
  for (let i = 1; ; i++) {
    const part = store.get(`${name}-${i}`);
    if (!part) {
      break;
    }
    response.cookies.delete(`${name}-${i}`);
  }
}
