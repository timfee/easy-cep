"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useWorkflow } from "@/components/workflow/context";
import  { type Provider } from "@/constants";
import { Var, type WorkflowVars } from "@/lib/workflow/variables";

interface Props {
  onUpdate(vars: Partial<WorkflowVars>): void;
}

interface SessionTokens {
  googleAccessToken?: string;
  googleExpiresAt?: number;
  msGraphToken?: string;
  msGraphExpiresAt?: number;
}

interface ProviderItemProps {
  Icon: React.ElementType;
  name: string;
  isConnected: boolean;
  onConnectClick: () => void;
  onDisconnectClick: () => void;
  minutesLeft: number;
  iconColorClass: string;
}

/**
 * Render a single provider connection row.
 */
function ProviderItem({
  Icon,
  name,
  isConnected,
  onConnectClick,
  onDisconnectClick,
  minutesLeft,
  iconColorClass,
}: ProviderItemProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md px-3 py-2 transition-colors hover:bg-muted/50">
      <div className="flex items-center gap-2.5">
        <Icon className={`h-5 w-5 ${iconColorClass}`} />
        <span className="font-medium text-foreground text-sm">{name}</span>
      </div>
      <div className="flex items-center gap-2">
        {isConnected ? (
          <Button
            aria-label={`Disconnect ${name}`}
            className="group relative mx-1.5 min-w-[92px] overflow-hidden text-[11px] text-foreground/80"
            onClick={onDisconnectClick}
            size="sm"
            title="Disconnect"
            variant="outline"
          >
            <span className="transition-all duration-300 group-hover:-translate-y-full group-hover:opacity-0">
              {minutesLeft}m left
            </span>
            <span className="absolute inset-0 flex translate-y-full items-center justify-center opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
              Sign out
            </span>
          </Button>
        ) : (
          <Button
            className="mx-1.5 text-[11px] font-medium"
            onClick={onConnectClick}
            size="sm"
            variant="default"
          >
            Connect
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Manage OAuth connections for supported providers.
 */
export function ProviderLogin({ onUpdate }: Props) {
  const { setSessionLoaded } = useWorkflow();
  const [tokens, setTokens] = useState<SessionTokens>({});

  const loadTokens = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session");
      if (!res.ok) {
        return;
      }

      const data: SessionTokens = await res.json();
      const now = Date.now();
      const validGoogle =
        data.googleAccessToken &&
        data.googleExpiresAt &&
        data.googleExpiresAt > now;
      const validMicrosoft =
        data.msGraphToken &&
        data.msGraphExpiresAt &&
        data.msGraphExpiresAt > now;

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
        [Var.GoogleAccessToken]: validGoogle
          ? data.googleAccessToken
          : undefined,
        [Var.MsGraphToken]: validMicrosoft ? data.msGraphToken : undefined,
      };
      onUpdate(vars);
    } finally {
      setSessionLoaded(true);
    }
  }, [onUpdate, setSessionLoaded]);

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

  const googleTimeLeftInMinutes = tokens.googleExpiresAt
    ? Math.max(0, Math.floor((tokens.googleExpiresAt - Date.now()) / 60_000))
    : 0;
  const msGraphTimeLeftInMinutes = tokens.msGraphExpiresAt
    ? Math.max(0, Math.floor((tokens.msGraphExpiresAt - Date.now()) / 60_000))
    : 0;

  return (
    <>
      <ProviderItem
        Icon={Google}
        iconColorClass="text-primary"
        isConnected={tokens.googleAccessToken !== undefined}
        minutesLeft={googleTimeLeftInMinutes}
        name="Google"
        onConnectClick={() => {
          window.location.href = "/api/auth/google";
        }}
        onDisconnectClick={() => signOut("google")}
      />
      <ProviderItem
        Icon={Microsoft}
        iconColorClass="text-foreground/70"
        isConnected={tokens.msGraphToken !== undefined}
        minutesLeft={msGraphTimeLeftInMinutes}
        name="Microsoft"
        onConnectClick={() => {
          window.location.href = "/api/auth/microsoft";
        }}
        onDisconnectClick={() => signOut("microsoft")}
      />
    </>
  );
}

/**
 * Google provider icon.
 */
const Google = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 20 20"
    xmlns="http://www.w3.org/2000/svg"
  >
    <title>Google</title>
    <path
      d="M19.822 8.004h-9.61c0 1 0 2.998-.007 3.998h5.569c-.213.999-.97 2.398-2.039 3.103-.001-.001-.002.006-.004.005-1.421.938-3.297 1.151-4.69.871-2.183-.433-3.91-2.016-4.612-4.027.004-.003.007-.031.01-.033C4 10.673 4 9.003 4.44 8.004c.565-1.837 2.345-3.513 4.53-3.972 1.759-.373 3.743.031 5.202 1.396.194-.19 2.685-2.622 2.872-2.82C12.058-1.907 4.077-.318 1.09 5.51l-.006.011a9.767 9.767 0 0 0 .01 8.964l-.01.008a10.18 10.18 0 0 0 6.48 5.165c3.01.79 6.843.25 9.41-2.072l.003.003c2.175-1.958 3.529-5.296 2.845-9.586"
      fill="#000"
      fillRule="evenodd"
    />
  </svg>
);

/**
 * Microsoft provider icon.
 */
const Microsoft = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <title>Microsoft</title>
    <path d="M0 0h24v24H0z" fill="none" />
    <path d="M3 12V6.75l6-1.32v6.48L3 12m17-9v8.75l-10 .15V5.21L20 3M3 13l6 .09v6.81l-6-1.15V13m17 .25V22l-10-1.91v-7Z" />
  </svg>
);
