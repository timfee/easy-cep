"use client";
import { LogLevel, StepLogEntry } from "@/types";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useState } from "react";
import { Badge } from "./ui/badge";

interface StepLogsProps {
  logs: StepLogEntry[] | undefined;
}

export default function StepLogs({ logs }: StepLogsProps) {
  const [expanded, setExpanded] = useState(false);
  if (!logs || logs.length === 0) return null;

  const levelClass: Record<LogLevel, string> = {
    [LogLevel.Info]: "bg-blue-100 text-blue-700",
    [LogLevel.Warn]: "bg-amber-100 text-amber-700",
    [LogLevel.Error]: "bg-red-100 text-red-700",
    [LogLevel.Debug]: "bg-zinc-100 text-zinc-700"
  };

  return (
    <div className="mt-4 text-xs">
      <button
        className="group flex w-full items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-medium text-zinc-700 hover:bg-zinc-100"
        onClick={() => setExpanded((prev) => !prev)}>
        <ChevronRightIcon
          className={clsx(
            "h-4 w-4 transition-transform",
            expanded && "rotate-90"
          )}
        />
        <span>Logs</span>
        <Badge className="ml-auto bg-zinc-100 text-zinc-700">
          {logs.length}
        </Badge>
      </button>
      {expanded && (
        <ul className="mt-2 max-h-80 space-y-2 overflow-y-auto pr-1">
          {logs.map((log, idx) => (
            <li
              key={idx}
              className="rounded border border-zinc-200 bg-white p-2 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-24 shrink-0 text-zinc-500">
                  {log.level && (
                    <Badge
                      className={`mb-1 ${levelClass[log.level]} text-[10px] px-1.5`}>
                      {log.level}
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
      )}
    </div>
  );
}
