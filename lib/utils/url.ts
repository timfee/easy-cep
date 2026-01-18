import { API_PREFIXES } from "@/constants";

/**
 * Strip a known API base URL into a display path.
 */
export function extractPath(url: string): string {
  const { GOOGLE_ADMIN, GOOGLE_CLOUD_IDENTITY, MS_GRAPH } = API_PREFIXES;

  if (url.startsWith(GOOGLE_ADMIN)) {
    return url.slice(GOOGLE_ADMIN.length);
  }
  if (url.startsWith(GOOGLE_CLOUD_IDENTITY)) {
    return `/cloudidentity${url.slice(GOOGLE_CLOUD_IDENTITY.length)}`;
  }
  if (url.startsWith(MS_GRAPH)) {
    return `/graph${url.slice(MS_GRAPH.length)}`;
  }
  return url;
}
