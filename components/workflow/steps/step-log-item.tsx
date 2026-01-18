"use client";

import {
  AlertTriangle,
  Bug,
  ChevronRight,
  Info,
  Network,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { extractPath } from "@/lib/utils/url";
import type { StepLogEntry } from "@/types";

/**
 * Select the icon for a log level.
 */
function getLevelIcon(level?: string) {
  switch (level) {
    case "warn":
      return <AlertTriangle className="h-3 w-3 text-chart-1" />;
    case "error":
      return <XCircle className="h-3 w-3 text-destructive" />;
    case "debug":
      return <Bug className="h-3 w-3 text-accent" />;
    default:
      return <Info className="h-3 w-3 text-primary" />;
  }
}

/**
 * Select the color classes for a log level.
 */
function getLevelClasses(level?: string) {
  switch (level) {
    case "warn":
      return "border-chart-1/20 text-chart-1";
    case "error":
      return "border-destructive/20 text-destructive";
    case "debug":
      return "border-accent/20 text-accent";
    default:
      return "border-primary/20 text-primary";
  }
}

/**
 * Select the color classes for request status.
 */
function getMethodClasses(success: boolean) {
  return success
    ? "border-secondary/20 text-secondary"
    : "border-destructive/20 text-destructive";
}

interface StepLogItemProps {
  log: StepLogEntry;
}

/**
 * Render a single log entry row with expandable details.
 */
export function StepLogItem({ log }: StepLogItemProps) {
  const [open, setOpen] = useState(false);
  const time = new Date(log.timestamp).toLocaleTimeString();

  const success = log.status === undefined || log.status < 400;

  return (
    <Collapsible
      className="font-mono text-xs"
      onOpenChange={setOpen}
      open={open}
    >
      <CollapsibleTrigger asChild>
        <div className="flex cursor-pointer items-center gap-2 px-4 py-2 hover:bg-muted">
          {log.method ? (
            <Network className="h-3 w-3 text-muted-foreground" />
          ) : (
            getLevelIcon(log.level)
          )}
          <span
            className={cn(
              "rounded border px-1.5 py-0.5",
              log.method
                ? getMethodClasses(success)
                : getLevelClasses(log.level)
            )}
          >
            {log.method ? log.method : (log.level || "info").toUpperCase()}
          </span>
          <span className="text-[10px] text-muted-foreground">{time}</span>
          <span className="flex-1 truncate text-foreground">
            {log.method
              ? `${log.message}: ${extractPath(log.url ?? "")}`
              : log.message}
          </span>
          {log.data !== null && log.data !== undefined && (
            <ChevronRight
              className={cn(
                "h-3 w-3 transition-transform",
                open && "rotate-90"
              )}
            />
          )}
        </div>
      </CollapsibleTrigger>
      {log.data !== null && log.data !== undefined && (
        <CollapsibleContent className="px-4 py-2 data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
          <div className="max-h-60 overflow-y-auto rounded border border-border/70 bg-muted text-foreground">
            <pre className="whitespace-pre-wrap p-2">
              {typeof log.data === "string"
                ? log.data
                : JSON.stringify(log.data, null, 2)}
            </pre>
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}
