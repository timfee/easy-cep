"use client";

import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  Chrome,
  Loader2,
  ComputerIcon as Microsoft,
  XCircle
} from "lucide-react";
import type React from "react";
import { useState } from "react";

interface ProviderLoginProps {
  onUpdate(vars: Partial<Record<string, unknown>>): void;
}

export function ProviderLogin({ onUpdate }: ProviderLoginProps) {
  const [googleConnected, setGoogleConnected] = useState(false);
  const [microsoftConnected, setMicrosoftConnected] = useState(false);
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const handleConnect = (provider: "google" | "microsoft") => {
    setLoading((prev) => ({ ...prev, [provider]: true }));
    setTimeout(() => {
      if (provider === "google") {
        setGoogleConnected(true);
        onUpdate({
          googleAccessToken: "mock-google-token-" + Date.now(),
          userEmail: "user@example.com"
        });
      } else {
        setMicrosoftConnected(true);
        onUpdate({ msGraphToken: "mock-msgraph-token-" + Date.now() });
      }
      setLoading((prev) => ({ ...prev, [provider]: false }));
    }, 1000);
  };

  const handleDisconnect = (provider: "google" | "microsoft") => {
    if (provider === "google") {
      setGoogleConnected(false);
      onUpdate({ googleAccessToken: undefined, userEmail: undefined });
    } else {
      setMicrosoftConnected(false);
      onUpdate({ msGraphToken: undefined });
    }
  };

  const ProviderItem = ({
    Icon,
    name,
    isConnected,
    onConnectClick,
    onDisconnectClick,
    isLoading,
    iconColorClass
  }: {
    Icon: React.ElementType;
    name: string;
    isConnected: boolean;
    onConnectClick: () => void;
    onDisconnectClick: () => void;
    isLoading: boolean;
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
              disabled={isLoading}
              className="text-xs px-2 py-1 h-auto border-slate-300 text-slate-700 hover:bg-slate-100">
              {isLoading ?
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : "Connect"}
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
        name="Google"
        isConnected={googleConnected}
        onConnectClick={() => handleConnect("google")}
        onDisconnectClick={() => handleDisconnect("google")}
        isLoading={loading.google || false}
        iconColorClass="text-blue-500"
      />
      <ProviderItem
        Icon={Microsoft}
        name="Microsoft"
        isConnected={microsoftConnected}
        onConnectClick={() => handleConnect("microsoft")}
        onDisconnectClick={() => handleDisconnect("microsoft")}
        isLoading={loading.microsoft || false}
        iconColorClass="text-purple-500"
      />
    </div>
  );
}
