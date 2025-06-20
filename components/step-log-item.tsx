"use client";

import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@/components/ui/collapsible";
import { extractPath } from "@/lib/utils/url";
import { StepLogEntry } from "@/types";
import { AlertTriangle, Bug, ChevronRight, Info, XCircle } from "lucide-react";
import { useState } from "react";

interface StepLogItemProps {
  log: StepLogEntry;
}

function getLevelIcon(level?: string) {
  switch (level) {
    case "warn":
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case "error":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "debug":
      return <Bug className="h-4 w-4 text-purple-500" />;
    default:
      return <Info className="h-4 w-4 text-blue-500" />;
  }
}

function getLevelBadgeClasses(level?: string) {
  switch (level) {
    case "warn":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "error":
      return "bg-red-50 text-red-700 border-red-200";
    case "debug":
      return "bg-purple-50 text-purple-700 border-purple-200";
    default:
      return "bg-blue-50 text-blue-700 border-blue-200";
  }
}

function getLevelText(level?: string) {
  return (level || "info").toUpperCase();
}

function getMethodClasses(success: boolean) {
  return success ?
      "bg-green-50 text-green-700 border-green-200"
    : "bg-red-50 text-red-700 border-red-200";
}

export function StepLogItem({ log }: StepLogItemProps) {
  const [open, setOpen] = useState(false);
  const time = new Date(log.timestamp).toLocaleTimeString();

  if (log.method) {
    const success = log.status === undefined || log.status < 400;
    return (
      <Collapsible
        open={open}
        onOpenChange={setOpen}
        className="p-3 rounded-md border bg-white border-slate-200">
        <CollapsibleTrigger asChild>
          <div className="flex items-start gap-3 cursor-pointer">
            <div className={`p-1.5 rounded ${getMethodClasses(success)}`}>
              <span className="text-xs font-mono">{log.method}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {log.status !== undefined && (
                  <Badge
                    variant="outline"
                    className="bg-slate-100 text-slate-700 border-slate-200">
                    {log.status}
                  </Badge>
                )}
                <span className="text-xs text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                  {time}
                </span>
                {log.data !== null && (
                  <ChevronRight
                    className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""}`}
                  />
                )}
              </div>
              <p className="text-sm text-slate-800 leading-relaxed break-all">
                {extractPath(log.url ?? "")}
              </p>
            </div>
          </div>
        </CollapsibleTrigger>
        {log.data !== null && (
          <CollapsibleContent className="mt-2 transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <div className="bg-slate-800 text-slate-100 rounded p-2.5 border border-slate-700 max-h-60 overflow-y-auto">
              <pre className="text-xs font-mono whitespace-pre-wrap">
                {JSON.stringify(log.data, null, 2)}
              </pre>
            </div>
          </CollapsibleContent>
        )}
      </Collapsible>
    );
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="p-3 rounded-md border bg-white border-slate-200">
      <CollapsibleTrigger asChild>
        <div className="flex items-start gap-3 cursor-pointer">
          <div
            className={`p-1.5 rounded ${getLevelBadgeClasses(log.level).split(" ")[0].replace("bg-", "bg-opacity-20")}`}>
            {getLevelIcon(log.level)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge
                variant="outline"
                className={`${getLevelBadgeClasses(log.level)} font-semibold`}>
                {getLevelText(log.level)}
              </Badge>
              <span className="text-xs text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                {time}
              </span>
              {log.data !== null && (
                <ChevronRight
                  className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""}`}
                />
              )}
            </div>
            <p className="text-sm text-slate-800 leading-relaxed break-words">
              {log.message}
            </p>
          </div>
        </div>
      </CollapsibleTrigger>
      {log.data !== null && (
        <CollapsibleContent className="mt-2 transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <div className="bg-slate-800 text-slate-100 rounded p-2.5 border border-slate-700 max-h-60 overflow-y-auto">
            <pre className="text-xs font-mono whitespace-pre-wrap">
              {JSON.stringify(log.data, null, 2)}
            </pre>
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}
