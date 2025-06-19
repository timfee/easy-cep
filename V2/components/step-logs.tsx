"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  Bug,
  ChevronDown,
  ChevronRight,
  Info,
  Server,
  Terminal,
  XCircle
} from "lucide-react"; // Added Server, ZapIcon, Terminal
import { useState } from "react";

interface StepLogEntry {
  timestamp: number;
  message: string;
  data?: unknown;
  level?: "info" | "warn" | "error" | "debug";
  apiCall?: {
    method: string;
    url: string;
    request?: { headers?: Record<string, string>; body?: any };
    response?: { status: number; headers?: Record<string, string>; body?: any };
    duration?: number;
  };
}

interface StepLogsProps {
  logs: StepLogEntry[] | undefined;
}

export function StepLogs({ logs }: StepLogsProps) {
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());

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

  const toggleExpanded = (index: number) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedLogs(newExpanded);
  };

  const getLevelIcon = (level?: string) => {
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
  };

  const getLevelBadgeClasses = (level?: string) => {
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
  };

  const getLevelText = (level?: string) => {
    return (level || "info").toUpperCase();
  };

  const getStatusBadge = (status: number) => {
    if (status >= 200 && status < 300) {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
          {status}
        </Badge>
      );
    } else if (status >= 400 && status < 500) {
      return (
        <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">
          {status}
        </Badge>
      );
    } else if (status >= 500) {
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">
          {status}
        </Badge>
      );
    } else {
      return (
        <Badge
          variant="outline"
          className="bg-slate-100 text-slate-800 border-slate-200">
          {status}
        </Badge>
      );
    }
  };

  return (
    <ScrollArea className="h-[250px] -mx-2">
      <div className="space-y-1.5 px-2">
        {logs.map((log, index) => (
          <div
            key={index}
            className={`p-3 rounded-md border ${log.apiCall ? "bg-sky-50/70 border-sky-200" : "bg-white border-slate-200"}`}>
            {log.apiCall ?
              <Collapsible
                open={expandedLogs.has(index)}
                onOpenChange={() => toggleExpanded(index)}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between p-0 h-auto hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0">
                    <div className="flex items-start gap-3 w-full">
                      <div
                        className={`p-1.5 rounded ${log.apiCall.response && log.apiCall.response.status >= 400 ? "bg-red-100" : "bg-sky-100"}`}>
                        <Server
                          className={`h-4 w-4 ${log.apiCall.response && log.apiCall.response.status >= 400 ? "text-red-500" : "text-sky-600"}`}
                        />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge
                            variant="outline"
                            className="bg-sky-100 text-sky-800 border-sky-300 font-semibold">
                            API CALL
                          </Badge>
                          <Badge
                            variant="outline"
                            className="bg-slate-100 text-slate-700 border-slate-300">
                            {log.apiCall.method}
                          </Badge>
                          {log.apiCall.response
                            && getStatusBadge(log.apiCall.response.status)}
                          {log.apiCall.duration && (
                            <span className="text-xs text-slate-500">
                              {log.apiCall.duration}ms
                            </span>
                          )}
                          <span className="text-xs text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <code className="text-sm text-slate-800 break-all">
                          {log.apiCall.url}
                        </code>
                      </div>
                      <div className="flex-shrink-0 pt-0.5">
                        {expandedLogs.has(index) ?
                          <ChevronDown className="h-4 w-4 text-slate-500" />
                        : <ChevronRight className="h-4 w-4 text-slate-500" />}
                      </div>
                    </div>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3 animate-accordion-down">
                  <div className="space-y-3 pl-8">
                    {log.apiCall.request && (
                      <div>
                        <h5 className="text-xs font-semibold text-slate-600 mb-1.5">
                          Request:
                        </h5>
                        <div className="bg-slate-800 text-slate-100 rounded p-2.5 border border-slate-700 max-h-60 overflow-y-auto">
                          <pre className="text-xs font-mono whitespace-pre-wrap">
                            {JSON.stringify(log.apiCall.request, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                    {log.apiCall.response && (
                      <div>
                        <h5 className="text-xs font-semibold text-slate-600 mb-1.5">
                          Response:
                        </h5>
                        <div className="bg-slate-800 text-slate-100 rounded p-2.5 border border-slate-700 max-h-60 overflow-y-auto">
                          <pre className="text-xs font-mono whitespace-pre-wrap">
                            {JSON.stringify(log.apiCall.response, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            : <div className="flex items-start gap-3">
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
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm text-slate-800 leading-relaxed">
                    {log.message}
                  </p>
                  {log.data && (
                    <Collapsible className="mt-2">
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="link"
                          size="sm"
                          className="text-xs p-0 h-auto text-blue-600 hover:text-blue-700">
                          View Data{" "}
                          {expandedLogs.has(index + logs.length) ?
                            <ChevronDown className="h-3 w-3 ml-1" />
                          : <ChevronRight className="h-3 w-3 ml-1" />}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-1 animate-accordion-down">
                        <div className="bg-slate-800 text-slate-100 rounded p-2.5 border border-slate-700 max-h-60 overflow-y-auto">
                          <pre className="text-xs font-mono whitespace-pre-wrap">
                            {JSON.stringify(log.data, null, 2)}
                          </pre>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              </div>
            }
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
