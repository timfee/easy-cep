"use client";

import { useEffect, useRef } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import type  { StepLogEntry } from "@/types";

import { StepLogItem } from "./step-log-item";

interface StepLogsProps {
  logs: StepLogEntry[] | undefined;
}

/**
 * Render a scrollable list of step logs.
 */
export function StepLogs({ logs }: StepLogsProps) {
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!logs || logs.length === 0) {
      return;
    }
    const el = scrollAreaRef.current;
    if (!el) {
      return;
    }

    const viewport = el.querySelector('[data-slot="scroll-area-viewport"]');
    if (viewport instanceof HTMLDivElement) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  });

  if (!logs || logs.length === 0) {
    return null;
  }

  return (
    <ScrollArea
      className="max-h-64 overflow-y-auto"
      onClick={(e) => e.stopPropagation()}
      ref={scrollAreaRef}
    >
      <div className="divide-y">
        {logs.map((log, index) => (
          <StepLogItem key={`${log.timestamp}-${index}`} log={log} />
        ))}
      </div>
    </ScrollArea>
  );
}
