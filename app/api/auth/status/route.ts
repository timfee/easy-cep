import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiEndpoint, PROVIDERS } from "@/constants";
import { clearChunkedCookie, refreshTokenWithResult } from "@/lib/auth";

const GOOGLE_REQUIRED_SCOPE =
  "https://www.googleapis.com/auth/admin.directory.user";

const GoogleTokenInfoSchema = z
  .object({
    scope: z.string().optional(),
  })
  .passthrough();

interface ProviderStatus {
  connected: boolean;
  valid: boolean;
  reauthRequired: boolean;
  reason?: string;
  accessToken?: string;
  expiresAt?: number;
}

const isAuthErrorStatus = (status: number) => status >= 400 && status < 500;

const buildBaseStatus = (
  result: Awaited<ReturnType<typeof refreshTokenWithResult>>
): ProviderStatus => ({
  connected: result.token !== null && result.status !== "reauth",
  valid: false,
  reauthRequired: result.status === "reauth",
  reason: result.error?.code,
});

const buildGoogleStatus = async (): Promise<ProviderStatus> => {
  const googleResult = await refreshTokenWithResult(PROVIDERS.GOOGLE);
  const status = buildBaseStatus(googleResult);

  if (!googleResult.token?.accessToken || status.reauthRequired) {
    return status;
  }

  try {
    const res = await fetch(
      `${ApiEndpoint.GoogleAuth.TokenInfo}?access_token=${encodeURIComponent(
        googleResult.token.accessToken
      )}`,
      { cache: "no-store" }
    );
    if (res.ok) {
      const data = GoogleTokenInfoSchema.parse(await res.json());
      const scope = data.scope ?? "";
      status.valid = scope.includes(GOOGLE_REQUIRED_SCOPE);
      if (!status.valid) {
        status.reauthRequired = true;
        status.reason = "missing_scope";
      }
    } else if (isAuthErrorStatus(res.status)) {
      status.reauthRequired = true;
      status.reason = "invalid_token";
    }
  } catch {
    status.valid = false;
  }

  if (status.reauthRequired) {
    status.connected = false;
  }

  if (status.connected && googleResult.token) {
    status.accessToken = googleResult.token.accessToken;
    status.expiresAt = googleResult.token.expiresAt;
  }

  return status;
};

const buildMicrosoftStatus = async (): Promise<ProviderStatus> => {
  const microsoftResult = await refreshTokenWithResult(PROVIDERS.MICROSOFT);
  const status = buildBaseStatus(microsoftResult);

  if (!microsoftResult.token?.accessToken || status.reauthRequired) {
    return status;
  }

  try {
    const res = await fetch(ApiEndpoint.Microsoft.Me, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${microsoftResult.token.accessToken}` },
    });
    if (res.ok) {
      status.valid = true;
    } else if (isAuthErrorStatus(res.status)) {
      status.reauthRequired = true;
      status.reason = "invalid_token";
    }
  } catch {
    status.valid = false;
  }

  if (status.reauthRequired) {
    status.connected = false;
  }

  if (status.connected && microsoftResult.token) {
    status.accessToken = microsoftResult.token.accessToken;
    status.expiresAt = microsoftResult.token.expiresAt;
  }

  return status;
};

/**
 * Verify provider tokens against their APIs.
 */
export async function GET() {
  const [googleStatus, microsoftStatus] = await Promise.all([
    buildGoogleStatus(),
    buildMicrosoftStatus(),
  ]);

  const response = NextResponse.json({
    google: googleStatus,
    microsoft: microsoftStatus,
  });

  if (googleStatus.reauthRequired) {
    await clearChunkedCookie(response, `${PROVIDERS.GOOGLE}_token`);
  }
  if (microsoftStatus.reauthRequired) {
    await clearChunkedCookie(response, `${PROVIDERS.MICROSOFT}_token`);
  }

  return response;
}
