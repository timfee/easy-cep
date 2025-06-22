"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { StepLogEntry } from "@/types";
import { useEffect, useRef } from "react";
import { StepLogItem } from "./step-log-item";

interface StepLogsProps {
  logs: StepLogEntry[] | undefined;
}

export function StepLogs({ logs }: StepLogsProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const viewport = el.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLDivElement | null;
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [logs]);

  if (!logs || logs.length === 0) {
    return null;
  }

  return (
    <ScrollArea
      ref={ref}
      className="max-h-64 overflow-y-auto"
      onClick={(e) => e.stopPropagation()}>
      <div className="divide-y">
        {logs.map((log, index) => (
          <StepLogItem key={index} log={log} />
        ))}
      </div>
    </ScrollArea>
  );
}
