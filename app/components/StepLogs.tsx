"use client";
import { LogLevel, StepLogEntry } from "@/types";
import { Badge } from "./ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "./ui/table";

interface StepLogsProps {
  logs: StepLogEntry[] | undefined;
}

const INDENT = 2;

export default function StepLogs({ logs }: StepLogsProps) {
  if (!logs || logs.length === 0) return null;

  const levelColor: Record<LogLevel, Parameters<typeof Badge>[0]["color"]> = {
    [LogLevel.Info]: "blue",
    [LogLevel.Warn]: "amber",
    [LogLevel.Error]: "red",
    [LogLevel.Debug]: "zinc"
  };

  return (
    <details className="mt-2">
      <summary className="cursor-pointer">Logs</summary>
      <div className="mt-1 max-h-48 overflow-auto">
        <Table bleed dense grid striped className="text-xs">
          <TableHead>
            <TableRow>
              <TableHeader>Time</TableHeader>
              <TableHeader>Level</TableHeader>
              <TableHeader>Message</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.map((l, idx) => (
              <TableRow key={idx}>
                <TableCell>
                  {new Date(l.timestamp).toLocaleTimeString()}
                </TableCell>
                <TableCell>
                  {l.level && (
                    <Badge color={levelColor[l.level]}>{l.level}</Badge>
                  )}
                </TableCell>
                <TableCell className="whitespace-pre-wrap">
                  {l.message}
                  {l.data !== undefined && l.data !== null && (
                    <pre className="mt-1 rounded bg-gray-100 p-1 dark:bg-zinc-800">
                      {JSON.stringify(l.data, null, INDENT)}
                    </pre>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </details>
  );
}
