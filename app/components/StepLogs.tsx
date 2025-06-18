"use client";
import { LogLevel, StepLogEntry } from "@/types";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Dialog, DialogActions, DialogBody, DialogTitle } from "./ui/dialog";
import { Table, TableBody, TableCell, TableRow } from "./ui/table";

interface StepLogsProps {
  logs: StepLogEntry[] | undefined;
}

export default function StepLogs({ logs }: StepLogsProps) {
  const [open, setOpen] = useState(false);
  if (!logs || logs.length === 0) return null;

  const levelColor: Record<LogLevel, "blue" | "amber" | "red" | "zinc"> = {
    [LogLevel.Info]: "blue",
    [LogLevel.Warn]: "amber",
    [LogLevel.Error]: "red",
    [LogLevel.Debug]: "zinc"
  };

  return (
    <div className="mt-4">
      <button
        className="group flex w-full items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
        onClick={() => setOpen(true)}>
        <ChevronRightIcon className="h-4 w-4" />
        <span>Logs</span>
        <Badge color="zinc" className="ml-auto">
          {logs.length}
        </Badge>
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} size="3xl">
        <DialogTitle>Logs</DialogTitle>
        <DialogBody>
          <div className="max-h-96 overflow-y-auto">
            <Table dense bleed>
              <TableBody>
                {logs.map((log, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="w-28 text-xs text-zinc-500">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </TableCell>
                    <TableCell className="w-20">
                      {log.level && (
                        <Badge size="xs" color={levelColor[log.level]}>
                          {log.level}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <details className="group">
                        <summary className="cursor-pointer text-sm">
                          {log.message}
                        </summary>
                        {log.data && (
                          <pre className="mt-2 overflow-x-auto rounded bg-zinc-50 p-2 text-xs">
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
        </DialogBody>
        <DialogActions>
          <Button onClick={() => setOpen(false)} plain>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
