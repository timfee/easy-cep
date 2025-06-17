"use client";
import { PROVIDERS } from "@/constants";
import { Var, WorkflowVars } from "@/types";
import { useCallback, useEffect, useState } from "react";

interface Props {
  onUpdate(vars: Partial<WorkflowVars>): void;
}

interface SessionTokens {
  googleAccessToken?: string;
  msGraphToken?: string;
}

export default function ProviderLogin({ onUpdate }: Props) {
  const [tokens, setTokens] = useState<SessionTokens>({});

  const loadTokens = useCallback(async () => {
    const res = await fetch("/api/auth/session");
    if (res.ok) {
      const data = await res.json();
      setTokens(data);
      const vars: Partial<WorkflowVars> = {};
      if (data.googleAccessToken)
        vars[Var.GoogleAccessToken] = data.googleAccessToken;
      if (data.msGraphToken) vars[Var.MsGraphToken] = data.msGraphToken;
      if (Object.keys(vars).length) onUpdate(vars);
    }
  }, [onUpdate]);

  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  return (
    <div className="border p-4 rounded mb-4">
      <h2 className="font-semibold mb-2">Provider Login</h2>
      <div className="space-x-2">
        {tokens.googleAccessToken ?
          <button
            className="px-2 py-1 bg-gray-600 text-white rounded"
            onClick={() =>
              (window.location.href = `/api/auth/signout/${PROVIDERS.GOOGLE}`)
            }>
            Sign out Google
          </button>
        : <button
            className="px-2 py-1 bg-blue-600 text-white rounded"
            onClick={() =>
              (window.location.href = `/api/auth/${PROVIDERS.GOOGLE}`)
            }>
            Sign in with Google
          </button>
        }
        {tokens.msGraphToken ?
          <button
            className="px-2 py-1 bg-gray-600 text-white rounded"
            onClick={() =>
              (window.location.href = `/api/auth/signout/${PROVIDERS.MICROSOFT}`)
            }>
            Sign out Microsoft
          </button>
        : <button
            className="px-2 py-1 bg-blue-600 text-white rounded"
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
