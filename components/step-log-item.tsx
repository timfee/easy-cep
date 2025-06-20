"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { extractPath } from "@/lib/utils/url";
import { StepLogEntry } from "@/types";
import {
  AlertTriangle,
  Bug,
  ChevronRight,
  Info,
  Network,
  XCircle
} from "lucide-react";
import { useState } from "react";

interface StepLogItemProps {
  log: StepLogEntry;
}

function getLevelIcon(level?: string) {
  switch (level) {
    case "warn":
      return <AlertTriangle className="h-3 w-3 text-amber-500" />;
    case "error":
      return <XCircle className="h-3 w-3 text-red-500" />;
    case "debug":
      return <Bug className="h-3 w-3 text-purple-500" />;
    default:
      return <Info className="h-3 w-3 text-blue-500" />;
  }
}

function getLevelClasses(level?: string) {
  switch (level) {
    case "warn":
      return "border-amber-200 text-amber-700";
    case "error":
      return "border-red-200 text-red-700";
    case "debug":
      return "border-purple-200 text-purple-700";
    default:
      return "border-blue-200 text-blue-700";
  }
}

function getMethodClasses(success: boolean) {
  return success ?
      "border-green-200 text-green-700"
    : "border-red-200 text-red-700";
}

export function StepLogItem({ log }: StepLogItemProps) {
  const [open, setOpen] = useState(false);
  const time = new Date(log.timestamp).toLocaleTimeString();

  const success = log.status === undefined || log.status < 400;

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="text-xs font-mono">
      <CollapsibleTrigger asChild>
        <div className="flex items-center gap-2 px-2 py-1 hover:bg-slate-100 cursor-pointer">
          {log.method ?
            <Network className="h-3 w-3 text-slate-500" />
          : getLevelIcon(log.level)}
          <span
            className={cn(
              "px-1.5 py-0.5 rounded border",
              log.method ?
                getMethodClasses(success)
              : getLevelClasses(log.level)
            )}>
            {log.method ? log.method : (log.level || "info").toUpperCase()}
          </span>
          <span className="text-[10px] text-slate-500">{time}</span>
          <span className="flex-1 truncate text-slate-800">
            {log.method ? extractPath(log.url ?? "") : log.message}
          </span>
          {log.data !== null && (
            <ChevronRight
              className={cn(
                "h-3 w-3 transition-transform",
                open && "rotate-90"
              )}
            />
          )}
        </div>
      </CollapsibleTrigger>
      {log.data !== null && (
        <CollapsibleContent className="px-4 py-2 data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
          <div className="bg-slate-800 text-slate-100 rounded border border-slate-700 max-h-60 overflow-y-auto">
            <pre className="p-2 whitespace-pre-wrap">
              {JSON.stringify(log.data, null, 2)}
            </pre>
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}
