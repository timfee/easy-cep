"use client";
import { StepIdValue, StepUIState, VarName, WorkflowVars } from "@/types";
import React from "react";
import StepLogs from "./StepLogs";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

import { Heading } from "./ui/heading";

export interface StepInfo {
  id: StepIdValue;
  requires: readonly VarName[];
  provides: readonly VarName[];
}

const statusColor: Record<
  StepUIState["status"],
  "zinc" | "sky" | "blue" | "green" | "red" | "amber"
> = {
  idle: "zinc",
  checking: "sky",
  executing: "blue",
  complete: "green",
  failed: "red",
  pending: "amber"
};

const indicatorColor: Record<StepUIState["status"], string> = {
  idle: "bg-gray-700",
  checking: "bg-blue-500 animate-pulse",
  executing: "bg-blue-500 animate-pulse",
  complete: "bg-green-500",
  failed: "bg-red-500",
  pending: "bg-amber-500"
};

interface StepCardProps {
  definition: StepInfo;
  state?: StepUIState;
  vars: Partial<WorkflowVars>;
  executing: boolean;
  onExecute(id: StepIdValue): void;
}

export default function StepCard({
  definition,
  state,
  vars,
  executing,
  onExecute
}: StepCardProps) {
  const missing = definition.requires.filter((v) => !vars[v]);

  return (
    <div className="relative mb-4 rounded-xl p-6 backdrop-blur-xl bg-white/[0.02] border border-white/[0.05] shadow-[0_0_0_1px_rgba(255,255,255,0.03)] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08)] hover:bg-white/[0.03] transition-all duration-300 ease-out hover:scale-[1.01] space-y-3">
      <div
        className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl ${indicatorColor[state?.status ?? "idle"]}`}></div>
      <Heading level={2} className="text-white font-medium text-lg">
        {definition.id}
      </Heading>
      <div className="text-sm flex items-center gap-2">
        <span>Status:</span>
        <Badge
          className="px-2.5 py-0.5 rounded-full"
          color={statusColor[state?.status ?? "idle"]}>
          {state?.status ?? "idle"}
        </Badge>
      </div>
      {(state?.summary || state?.error || state?.notes) && (
        <div className="text-sm text-gray-300">
          {state?.summary || state?.error || state?.notes}
        </div>
      )}

      <div className="grid grid-cols-2 gap-6 mt-4">
        <div className="bg-black/20 rounded-lg p-4 border border-white/[0.05]">
          <Heading level={3} className="mb-2 text-sm font-medium text-gray-400">
            Requires
          </Heading>
          <ul className="space-y-1 text-sm text-gray-300">
            {definition.requires.map((v) => (
              <li key={v} className="flex justify-between">
                <span className="font-mono">{v}</span>
                <span className={vars[v] ? "text-green-400" : "text-gray-600"}>
                  ✓
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-black/20 rounded-lg p-4 border border-white/[0.05]">
          <Heading level={3} className="mb-2 text-sm font-medium text-gray-400">
            Provides
          </Heading>
          <ul className="space-y-1 text-sm text-gray-300">
            {definition.provides.map((v) => (
              <li key={v} className="flex justify-between">
                <span className="font-mono">{v}</span>
                <span className={vars[v] ? "text-green-400" : "text-gray-600"}>
                  ✓
                </span>
              </li>
            ))}
          </ul>
        </div>

      </div>

      {state?.status !== "complete" && (
        <Button
          color="blue"
          onClick={() => onExecute(definition.id)}
          disabled={executing || missing.length > 0}>
          Execute
        </Button>
      )}

      <StepLogs logs={state?.logs} />
    </div>
  );
}
