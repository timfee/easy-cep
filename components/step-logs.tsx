"use client";

import { StepLogItem } from "@/components/step-log-item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StepLogEntry } from "@/types";
import { Terminal } from "lucide-react";

interface StepLogsProps {
  logs: StepLogEntry[] | undefined;
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
