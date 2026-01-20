"use client";

import { createContext, useContext } from "react";

import type { StepIdValue } from "@/lib/workflow/step-ids";
import type { VarName } from "@/lib/workflow/variables";

interface StepCardActions {
  onExecute: (id: StepIdValue) => void;
  onUndo: (id: StepIdValue) => void;
  onForce: (id: StepIdValue) => void;
  handleVarChange: (key: VarName, value: unknown) => void;
}

const StepCardContext = createContext<StepCardActions | null>(null);

/**
 * Provider that supplies step card actions.
 */
export const StepCardProvider = StepCardContext.Provider;

/**
 * Access step card action handlers.
 */
export function useStepCardActions() {
  const context = useContext(StepCardContext);
  if (!context) {
    throw new Error("useStepCardActions must be used within StepCardProvider");
  }
  return context;
}
