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
    <div className="mb-6 rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">
        Provider Login
      </h2>
      <div className="flex flex-col gap-3 sm:flex-row">
        {tokens.googleAccessToken ?
          <Button color="zinc" onClick={() => signOut(PROVIDERS.GOOGLE)}>
            <span>G</span>
            {`Sign out Google`}
          </Button>
        : <Button
            color="blue"
            onClick={() =>
              (window.location.href = `/api/auth/${PROVIDERS.GOOGLE}`)
            }>
            <span>G</span>
            Sign in with Google
          </Button>
        }
        {tokens.msGraphToken ?
          <Button color="zinc" onClick={() => signOut(PROVIDERS.MICROSOFT)}>
            <span>M</span>
            {`Sign out Microsoft`}
          </Button>
        : <Button
            color="blue"
            onClick={() =>
              (window.location.href = `/api/auth/${PROVIDERS.MICROSOFT}`)
            }>
            <span>M</span>
            Sign in with Microsoft
          </Button>
        }
      </div>
    </div>
  );
}
