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
    <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.05] rounded-xl shadow-[0_0_0_1px_rgba(255,255,255,0.03)] mb-4 p-4 transition-all duration-200 ease-out">
      <h2 className="font-semibold mb-2 text-white">Provider Login</h2>
      <div className="flex flex-col sm:flex-row gap-2">
        {tokens.googleAccessToken ?
          <button
            className="px-3 py-1.5 rounded backdrop-blur-sm bg-white/10 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 ease-out"
            onClick={() => signOut(PROVIDERS.GOOGLE)}>
            {`Sign out Google${
              tokens.googleExpiresAt ?
                ` (valid until ${new Date(tokens.googleExpiresAt).toLocaleTimeString()})`
              : ""
            }`}
          </button>
        : <button
            className="px-3 py-1.5 rounded bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 ease-out"
            onClick={() =>
              (window.location.href = `/api/auth/${PROVIDERS.GOOGLE}`)
            }>
            Sign in with Google
          </button>
        }
        {tokens.msGraphToken ?
          <button
            className="px-3 py-1.5 rounded backdrop-blur-sm bg-white/10 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 ease-out"
            onClick={() => signOut(PROVIDERS.MICROSOFT)}>
            {`Sign out Microsoft${
              tokens.msGraphExpiresAt ?
                ` (valid until ${new Date(tokens.msGraphExpiresAt).toLocaleTimeString()})`
              : ""
            }`}
          </button>
        : <button
            className="px-3 py-1.5 rounded bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 ease-out"
            onClick={() =>
              (window.location.href = `/api/auth/${PROVIDERS.MICROSOFT}`)
            }>
            Sign in with Microsoft
          </button>
        }
      </div>
    </div>
  );
}
