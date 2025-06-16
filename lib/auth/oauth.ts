import { ApiEndpoint, Provider, PROVIDERS } from "@/constants";

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
}

const googleOAuthConfig: OAuthConfig = {
  clientId: process.env.GOOGLE_CLIENT_ID || "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  redirectUri: `/api/auth/callback/google`,
  authorizationUrl: ApiEndpoint.GoogleAuth.Authorize,
  tokenUrl: ApiEndpoint.GoogleAuth.Token,
  scopes: [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/admin.directory.user",
    "https://www.googleapis.com/auth/admin.directory.orgunit",
    "https://www.googleapis.com/auth/admin.directory.domain",
    "https://www.googleapis.com/auth/admin.directory.rolemanagement",
    "https://www.googleapis.com/auth/cloud-identity.inboundsso",
    "https://www.googleapis.com/auth/siteverification",
    "https://www.googleapis.com/auth/admin.directory.rolemanagement"
  ]
};

const microsoftOAuthConfig: OAuthConfig = {
  clientId: process.env.MICROSOFT_CLIENT_ID || "",
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET || "",
  redirectUri: `/api/auth/callback/microsoft`,
  authorizationUrl: ApiEndpoint.MicrosoftAuth.Authorize,
  tokenUrl: ApiEndpoint.MicrosoftAuth.Token,
  scopes: [
    "openid",
    "profile",
    "email",
    "offline_access",
    "User.Read",
    "Directory.Read.All",
    "Application.ReadWrite.All",
    "AppRoleAssignment.ReadWrite.All",
    "Policy.ReadWrite.ApplicationConfiguration",
    "offline_access"
  ]
};

function getOAuthConfig(provider: Provider): OAuthConfig {
  return provider === PROVIDERS.GOOGLE ?
      googleOAuthConfig
    : microsoftOAuthConfig;
}

export interface Token {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string[];
}

export function generateAuthUrl(
  provider: Provider,
  state: string,
  baseUrl: string
): string {
  const config = getOAuthConfig(provider);
  const params = new URLSearchParams();
  const redirectUri = new URL(config.redirectUri, baseUrl).toString();
  params.set("client_id", config.clientId);
  params.set("redirect_uri", redirectUri);
  params.set("response_type", "code");
  params.set("scope", config.scopes.join(" "));
  params.set("state", state);
  if (provider === PROVIDERS.GOOGLE) {
    params.set("access_type", "offline");
    params.set("prompt", "consent");
  }
  return `${config.authorizationUrl}?${params.toString()}`;
}

export async function exchangeCodeForToken(
  provider: Provider,
  code: string,
  baseUrl: string
): Promise<Token> {
  const config = getOAuthConfig(provider);
  const redirectUri = new URL(config.redirectUri, baseUrl).toString();
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code"
  });

  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope?.split(" ") || config.scopes
  };
}
