"use client";
import { StepLogEntry } from "@/types";

interface StepLogsProps {
  logs: StepLogEntry[] | undefined;
}

export default function StepLogs({ logs }: StepLogsProps) {
  if (!logs || logs.length === 0) return null;
  return (
    <details className="mt-2">
      <summary className="cursor-pointer">Logs</summary>
      <ul className="text-xs space-y-1 mt-1">
        {logs.map((l, idx) => (
          <li key={idx}>
            [{new Date(l.timestamp).toLocaleTimeString()}]
            {l.level ? ` [${l.level}]` : ""} {l.message}
            {l.data && (
              <pre className="whitespace-pre-wrap bg-gray-100 p-1 mt-1">
                {JSON.stringify(l.data, null, 2)}
              </pre>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
