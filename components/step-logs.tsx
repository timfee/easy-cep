"use client";

import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StepLogEntry } from "@/types";
import {
  AlertTriangle,
  Bug,
  ChevronRight,
  Info,
  Terminal,
  XCircle
} from "lucide-react";
import { useState } from "react";

interface StepLogsProps {
  logs: StepLogEntry[] | undefined;
}

function StepLogItem({ log }: { log: StepLogEntry }) {
  const [open, setOpen] = useState(false);

  const getLevelIcon = (level?: string) => {
    switch (level) {
      case "warn":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "debug":
        return <Bug className="h-4 w-4 text-purple-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getLevelBadgeClasses = (level?: string) => {
    switch (level) {
      case "warn":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "error":
        return "bg-red-50 text-red-700 border-red-200";
      case "debug":
        return "bg-purple-50 text-purple-700 border-purple-200";
      default:
        return "bg-blue-50 text-blue-700 border-blue-200";
    }
  };

  const getLevelText = (level?: string) => {
    return (level || "info").toUpperCase();
  };

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="p-3 rounded-md border bg-white border-slate-200">
      <CollapsibleTrigger asChild>
        <div className="flex items-start gap-3 cursor-pointer">
          <div
            className={`p-1.5 rounded ${getLevelBadgeClasses(log.level)
              .split(" ")[0]
              .replace("bg-", "bg-opacity-20")}`}>
            {getLevelIcon(log.level)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge
                variant="outline"
                className={`${getLevelBadgeClasses(log.level)} font-semibold`}>
                {getLevelText(log.level)}
              </Badge>
              <span className="text-xs text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              {log.data !== null && (
                <ChevronRight
                  className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""}`}
                />
              )}
            </div>
            <p className="text-sm text-slate-800 leading-relaxed break-words">
              {log.message}
            </p>
          </div>
        </div>
      </CollapsibleTrigger>
      {log.data !== null && (
        <CollapsibleContent className="mt-2 transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <div className="bg-slate-800 text-slate-100 rounded p-2.5 border border-slate-700 max-h-60 overflow-y-auto">
            <pre className="text-xs font-mono whitespace-pre-wrap">
              {JSON.stringify(log.data, null, 2)}
            </pre>
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

export function StepLogs({ logs }: StepLogsProps) {
  if (!logs || logs.length === 0) {
    return (
      <div className="text-center py-6 text-slate-500">
        <div className="p-3 bg-slate-100 rounded-full w-fit mx-auto mb-3">
          <Terminal className="h-5 w-5 text-slate-400" />
        </div>
        <p className="text-sm font-medium">No logs available</p>
        <p className="text-xs text-slate-400 mt-1">
          Logs will appear here during step execution
        </p>
      </div>
    );
  }

  return (
    <ScrollArea
      className="h-[250px] -mx-2"
      onClick={(e) => e.stopPropagation()}>
      <div className="space-y-1.5 px-2">
        {logs.map((log, index) => (
          <StepLogItem key={index} log={log} />
        ))}
      </div>
    </ScrollArea>
  );
}
