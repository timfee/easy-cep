"use client";
import { LogLevel, StepLogEntry } from "@/types";
import clsx from "clsx";
import { AlertTriangle, Bug, ChevronRight, Info, XCircle } from "lucide-react";
import { useState } from "react";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";

interface StepLogsProps {
  logs: StepLogEntry[] | undefined;
}

export default function StepLogs({ logs }: StepLogsProps) {
  const [expanded, setExpanded] = useState(false);
  if (!logs || logs.length === 0) return null;

  const levelColor: Record<LogLevel, "blue" | "amber" | "red" | "zinc"> = {
    [LogLevel.Info]: "blue",
    [LogLevel.Warn]: "amber",
    [LogLevel.Error]: "red",
    [LogLevel.Debug]: "zinc"
  };

  const levelIcon = (level?: LogLevel) => {
    switch (level) {
      case LogLevel.Warn:
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case LogLevel.Error:
        return <XCircle className="h-4 w-4 text-red-500" />;
      case LogLevel.Debug:
        return <Bug className="h-4 w-4 text-purple-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <div className="mt-4 text-xs">
      <button
        className="group flex w-full items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-medium text-zinc-700 hover:bg-zinc-100"
        onClick={() => setExpanded((prev) => !prev)}>
        <ChevronRight
          className={clsx(
            "h-4 w-4 transition-transform",
            expanded && "rotate-90"
          )}
        />
        <span>Logs</span>
        <Badge color="zinc" className="ml-auto">
          {logs.length}
        </Badge>
      </button>
      {expanded && (
        <ScrollArea className="mt-2 max-h-80 pr-1">
          <ul className="space-y-2">
            {logs.map((log, idx) => (
              <li
                key={idx}
                className="rounded border border-zinc-200 bg-white p-2 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-24 shrink-0 text-zinc-500">
                    {log.level && (
                      <Badge
                        size="xs"
                        color={levelColor[log.level]}
                        className="mb-1 flex items-center gap-1">
                        {levelIcon(log.level)} {log.level}
                      </Badge>
                    )}
                    <div className="font-mono">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="font-mono break-words">{log.message}</p>
                    {log.data !== undefined && (
                      <pre className="mt-2 max-h-48 overflow-auto rounded bg-zinc-50 p-2">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </div>
  );
}
