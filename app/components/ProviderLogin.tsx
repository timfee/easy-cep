"use client";
import { PROVIDERS, type Provider } from "@/constants";
import { Var, WorkflowVars } from "@/types";
import { useCallback, useEffect, useState } from "react";

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
      data.googleAccessToken && data.googleExpiresAt && data.googleExpiresAt > now;
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

  const signOut = useCallback(
    async (provider: Provider) => {
      try {
        await fetch(`/api/auth/signout/${provider}`, { method: "POST" });
      } finally {
        window.location.href = "/";
      }
    },
    []
  );

  return (
    <div className="border p-4 rounded mb-4">
      <h2 className="font-semibold mb-2">Provider Login</h2>
      <div className="space-x-2">
        {tokens.googleAccessToken ? (
          <button
            className="px-2 py-1 bg-gray-600 text-white rounded"
            onClick={() => signOut(PROVIDERS.GOOGLE)}
          >
            {`Sign out Google${tokens.googleExpiresAt
              ? ` (valid until ${new Date(tokens.googleExpiresAt).toLocaleTimeString()})`
              : ""}`}
          </button>
        ) : (
          <button
            className="px-2 py-1 bg-blue-600 text-white rounded"
            onClick={() =>
              (window.location.href = `/api/auth/${PROVIDERS.GOOGLE}`)
            }
          >
            Sign in with Google
          </button>
        )}
        {tokens.msGraphToken ? (
          <button
            className="px-2 py-1 bg-gray-600 text-white rounded"
            onClick={() => signOut(PROVIDERS.MICROSOFT)}
          >
            {`Sign out Microsoft${tokens.msGraphExpiresAt
              ? ` (valid until ${new Date(tokens.msGraphExpiresAt).toLocaleTimeString()})`
              : ""}`}
          </button>
        ) : (
          <button
            className="px-2 py-1 bg-blue-600 text-white rounded"
            onClick={() =>
              (window.location.href = `/api/auth/${PROVIDERS.MICROSOFT}`)
            }
          >
            Sign in with Microsoft
          </button>
        )}
      </div>
    </div>
  );
}
