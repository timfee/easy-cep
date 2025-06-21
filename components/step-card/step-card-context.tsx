"use client";

import { StepIdValue, VarName } from "@/types";
import { createContext, useContext } from "react";

interface StepCardActions {
  onExecute: (id: StepIdValue) => void;
  onUndo: (id: StepIdValue) => void;
  onForce: (id: StepIdValue) => void;
  onVarChange: (key: VarName, value: unknown) => void;
}

const StepCardContext = createContext<StepCardActions | null>(null);

export const StepCardProvider = StepCardContext.Provider;

export function useStepCardActions() {
  const context = useContext(StepCardContext);
  if (!context)
    throw new Error("useStepCardActions must be used within StepCardProvider");
  return context;
}
