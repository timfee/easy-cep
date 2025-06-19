"use client";
import { Button } from "@/components/ui/button";
import { type Provider } from "@/constants";
import { Var, WorkflowVars } from "@/types";
import { BoxesIcon, CheckCircle, Chrome, XCircle } from "lucide-react";
import { redirect } from "next/navigation";
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

export function ProviderLogin({ onUpdate }: Props) {
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

  const ProviderItem = ({
    Icon,
    name,
    isConnected,
    onConnectClick,
    onDisconnectClick,
    iconColorClass
  }: {
    Icon: React.ElementType;
    name: string;
    isConnected: boolean;
    onConnectClick: () => void;
    onDisconnectClick: () => void;
    iconColorClass: string;
  }) => (
    <div className="flex items-center justify-between py-2.5">
      <div className="flex items-center gap-2.5">
        <Icon className={`h-5 w-5 ${iconColorClass}`} />
        <span className="text-sm font-medium text-slate-700">{name}</span>
      </div>
      <div className="flex items-center gap-2">
        {isConnected ?
          <>
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-xs text-green-600 font-medium">
              Connected
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={onDisconnectClick}
              className="text-slate-500 hover:text-red-600 h-auto px-1 py-0.5"
              aria-label={`Disconnect ${name}`}>
              <XCircle className="h-4 w-4" />
            </Button>
          </>
        : <>
            <XCircle className="h-4 w-4 text-slate-400" />
            <span className="text-xs text-slate-500">Not Connected</span>
            <Button
              size="sm"
              variant="outline"
              onClick={onConnectClick}
              className="text-xs px-2 py-1 h-auto border-slate-300 text-slate-700 hover:bg-slate-100">
              Connect
            </Button>
          </>
        }
      </div>
    </div>
  );

  return (
    <div className="space-y-1 divide-y divide-slate-100">
      <ProviderItem
        Icon={Chrome}
        name={"Google"}
        isConnected={tokens.googleAccessToken !== undefined}
        onConnectClick={() => (window.location.href = "/api/auth/google")}
        onDisconnectClick={() => signOut("google")}
        iconColorClass="text-blue-500"
      />
      <ProviderItem
        Icon={BoxesIcon}
        name="Microsoft"
        isConnected={tokens.msGraphToken !== undefined}
        onConnectClick={() => redirect("/api/auth/microsoft")}
        onDisconnectClick={() => signOut("microsoft")}
        iconColorClass="text-purple-500"
      />
    </div>
  );
}
