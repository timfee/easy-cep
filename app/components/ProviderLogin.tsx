"use client";
import { PROVIDERS, type Provider } from "@/constants";
import { Var, WorkflowVars } from "@/types";
import { useCallback, useEffect, useState } from "react";
import { Button } from "./ui/button";

interface Props {
  onUpdate(vars: Partial<WorkflowVars>): void;
}

interface SessionTokens {
  googleAccessToken?: string;
  googleExpiresAt?: number;
  msGraphToken?: string;
  msGraphExpiresAt?: number;
}

export default function ProviderLogin({ onUpdate }: Props) {
  const [tokens, setTokens] = useState<SessionTokens>({});

  const loadTokens = useCallback(async () => {
    const res = await fetch("/api/auth/session");
    if (!res.ok) return;

    const data: SessionTokens = await res.json();
    const now = Date.now();
    const validGoogle =
      data.googleAccessToken
      && data.googleExpiresAt
      && data.googleExpiresAt > now;
    const validMicrosoft =
      data.msGraphToken && data.msGraphExpiresAt && data.msGraphExpiresAt > now;

    const current: SessionTokens = {};
    if (validGoogle) {
      current.googleAccessToken = data.googleAccessToken;
      current.googleExpiresAt = data.googleExpiresAt;
    }
    if (validMicrosoft) {
      current.msGraphToken = data.msGraphToken;
      current.msGraphExpiresAt = data.msGraphExpiresAt;
    }

    setTokens(current);

    const vars: Partial<WorkflowVars> = {
      [Var.GoogleAccessToken]: validGoogle ? data.googleAccessToken : undefined,
      [Var.MsGraphToken]: validMicrosoft ? data.msGraphToken : undefined
    };
    onUpdate(vars);
  }, [onUpdate]);

  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  const signOut = useCallback(async (provider: Provider) => {
    try {
      await fetch(`/api/auth/signout/${provider}`, { method: "POST" });
    } finally {
      window.location.href = "/";
    }
  }, []);

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">
        Provider Login
      </h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex flex-col gap-2">
            {tokens.googleAccessToken ?
              <>
                <Button
                  variant="ghost"
                  className="w-full justify-center items-center"
                  onClick={() => signOut(PROVIDERS.GOOGLE)}>
                  Sign out of Google
                </Button>
                <div className="flex items-center justify-center gap-1.5 text-sm text-zinc-600">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                  <span>
                    {Math.round(
                      ((tokens.googleExpiresAt ?? 0) - Date.now()) / 60000
                    )}
                    m remaining
                  </span>
                </div>
              </>
            : <Button
                className="w-full justify-center items-center bg-blue-600 text-white hover:bg-blue-700"
                onClick={() =>
                  (window.location.href = `/api/auth/${PROVIDERS.GOOGLE}`)
                }>
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.971 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Sign in with Google
              </Button>
            }
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex flex-col gap-2">
            {tokens.msGraphToken ?
              <>
                <Button
                  variant="ghost"
                  className="w-full justify-center items-center"
                  onClick={() => signOut(PROVIDERS.MICROSOFT)}>
                  Sign out of Microsoft
                </Button>
                <div className="flex items-center justify-center gap-1.5 text-sm text-zinc-600">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                  <span>
                    {Math.round(
                      ((tokens.msGraphExpiresAt ?? 0) - Date.now()) / 60000
                    )}
                    m remaining
                  </span>
                </div>
              </>
            : <Button
                className="w-full justify-center items-center bg-blue-600 text-white hover:bg-blue-700"
                onClick={() =>
                  (window.location.href = `/api/auth/${PROVIDERS.MICROSOFT}`)
                }>
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path fill="#F35325" d="M1 1h10v10H1z" />
                  <path fill="#81BC06" d="M13 1h10v10H13z" />
                  <path fill="#05A6F0" d="M1 13h10v10H1z" />
                  <path fill="#FFBA08" d="M13 13h10v10H13z" />
                </svg>
                Sign in with Microsoft
              </Button>
            }
          </div>
        </div>
      </div>
    </div>
  );
}
