"use client";
import { LogLevel, StepLogEntry } from "@/types";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useState } from "react";
import { Badge } from "./ui/badge";
import { Table, TableBody, TableCell, TableRow } from "./ui/table";

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
        <Badge color="zinc" className="ml-auto">
          {logs.length}
        </Badge>
      </button>
      {expanded && (
        <div className="mt-2 max-h-80 overflow-y-auto">
          <Table dense bleed>
            <TableBody>
              {logs.map((log, idx) => (
                <TableRow key={idx}>
                  <TableCell className="w-28 text-xs text-zinc-500">
                    {log.level && (
                      <Badge size="xs" color={levelColor[log.level]} className="mb-1 block">
                        {log.level}
                      </Badge>
                    )}
                    <div>{new Date(log.timestamp).toLocaleTimeString()}</div>
                  </TableCell>
                  <TableCell className="py-2">
                    <details className="group">
                      <summary className="cursor-pointer text-xs">
                        {log.message}
                      </summary>
                      {log.data !== undefined && (
                        <pre className="mt-2 max-h-48 overflow-auto rounded bg-zinc-50 p-2 text-[10px]">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      )}
                    </details>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
