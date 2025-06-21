"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { StepLogEntry } from "@/types";
import { StepLogItem } from "./step-log-item";

interface StepLogsProps {
  logs: StepLogEntry[] | undefined;
}

export function StepLogs({ logs }: StepLogsProps) {
  if (!logs || logs.length === 0) {
    return null;
  }

  return (
    <ScrollArea className="max-h-64" onClick={(e) => e.stopPropagation()}>
      <div className="divide-y">
        {logs.map((log, index) => (
          <StepLogItem key={index} log={log} />
        ))}
      </div>
    </ScrollArea>
  );
}
