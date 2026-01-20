"use client";

import {
  AlertTriangle,
  Bug,
  ChevronRight,
  Info,
  Network,
  XCircle,
} from "lucide-react";
import {useState} from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {cn} from "@/lib/utils";
import {extractPath} from "@/lib/utils/url";
import {type StepLogEntry} from "@/types";

/**
 * Select the icon for a log level.
 */
function getLevelIcon(level?: string) {
  switch (level) {
    case "warn": {
      return <AlertTriangle className="h-3 w-3 text-chart-1" />;
    }
    case "error": {
      return <XCircle className="h-3 w-3 text-destructive" />;
    case "debug":
      return <Bug className="h-3 w-3 text-accent-foreground" />;
    default:
      return <Info className="h-3 w-3 text-primary" />;
  }
}
}

/**
 * Select the color classes for a log level.
 */
function getLevelClasses(level?: string) {
  switch (level) {
    case "warn":
      return "border-chart-1/30 bg-chart-1/10 text-chart-1";
    case "error":
      return "border-destructive/20 bg-destructive/10 text-destructive";
    case "debug":
      return "border-accent/30 bg-accent/20 text-accent-foreground";
    default:
      return "border-primary/20 bg-primary/10 text-primary";
  }
}

/**
 * Select the color classes for request status.
 */
function getMethodClasses(success: boolean) {
  return success
    ? "border-primary/20 bg-primary/10 text-primary"
    : "border-destructive/20 bg-destructive/10 text-destructive";
}

interface StepLogItemProps {
  log: StepLogEntry;
}

/**
 * Render a single log entry row with expandable details.
 */
export function StepLogItem({log}: StepLogItemProps) {
  const [open, setOpen] = useState(false);
  const time = new Date(log.timestamp).toLocaleTimeString();

  const success = log.status === undefined || log.status < 400;

  return (
    <Collapsible
      className="font-mono text-xs text-foreground/90"
      onOpenChange={setOpen}
      open={open}
    >
      <CollapsibleTrigger asChild>
        <button
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          type="button"
        >
          {log.method ? (
            <Network className="h-3 w-3 text-foreground/60" />
          ) : (
            getLevelIcon(log.level)
          )}
          <span
            className={cn(
              "rounded border px-1.5 py-0.5 text-[10px] font-semibold",
              log.method
                ? getMethodClasses(success)
                : getLevelClasses(log.level)
            )}
          >
            {log.method ? log.method : (log.level || "info").toUpperCase()}
          </span>
          <span className="text-[11px] text-foreground/75">{time}</span>
          <span className="flex-1 truncate text-foreground">
            {log.method
              ? `${log.message}: ${extractPath(log.url ?? "")}`
              : log.message}
          </span>
          {log.data !== null && log.data !== undefined && (
            <ChevronRight
              className={cn(
                "h-3 w-3 text-foreground/50 transition-transform",
                open && "rotate-90"
              )}
            />
          )}
        </button>
      </CollapsibleTrigger>
      {log.data !== null && log.data !== undefined && (
        <CollapsibleContent className="px-3 py-2 data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
          <div className="max-h-60 overflow-y-auto rounded border border-border bg-muted/50 text-foreground">
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
