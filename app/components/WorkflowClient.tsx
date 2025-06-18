"use client";

import { checkStep, runStep } from "@/lib/workflow/engine";
import { StepIdValue, StepUIState, Var, WorkflowVars } from "@/types";
import { useCallback, useEffect, useRef, useState } from "react";
import ProviderLogin from "./ProviderLogin";
import StepCard, { StepInfo } from "./StepCard";
import VarsInspector from "./VarsInspector";
import { Navbar, NavbarLabel, NavbarSection } from "./ui/navbar";
import {
  Sidebar,
  SidebarBody,
  SidebarItem,
  SidebarSection
} from "./ui/sidebar";
import { StackedLayout } from "./ui/stacked-layout";

interface Props {
  steps: ReadonlyArray<StepInfo>;
}

export default function WorkflowClient({ steps }: Props) {
  const initialized = useRef(false);
  const [vars, setVars] = useState<Partial<WorkflowVars>>({});
  const [status, setStatus] = useState<
    Partial<Record<StepIdValue, StepUIState>>
  >({});
  const [executing, setExecuting] = useState<StepIdValue | null>(null);

  // Generate a default password once on the client to avoid SSR mismatches
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      setVars((prev) => ({
        ...prev,
        [Var.GeneratedPassword]: Math.random().toString(36).slice(-12)
      }));
    }
  }, []);

  const updateVars = useCallback((newVars: Partial<WorkflowVars>) => {
    const keys = Object.keys(newVars) as (keyof typeof newVars)[];
    if (keys.length === 0) return;
    setVars((prev) => {
      let changed = false;
      for (const k of keys) {
        if (newVars[k] !== prev[k]) {
          changed = true;
          break;
        }
      }
      if (!changed) {
        return prev;
      }
      return { ...prev, ...newVars };
    });
    checkedSteps.current.clear();
  }, []);

  const updateStep = useCallback(
    (stepId: StepIdValue, stepState: StepUIState) =>
      setStatus((prev) => ({ ...prev, [stepId]: stepState })),
    []
  );

  const checkedSteps = useRef(new Set<StepIdValue>());
  useEffect(() => {
    (async () => {
      for (const step of steps) {
        if (checkedSteps.current.has(step.id)) continue;
        const missing = step.requires.filter((v) => !vars[v]);
        if (missing.length === 0) {
          checkedSteps.current.add(step.id);
          const result = await checkStep(step.id, vars);
          updateStep(step.id, result.state);
          if (Object.keys(result.newVars).length > 0) {
            updateVars(result.newVars);
          }
        }
      }
    })();
  }, [vars, steps, updateStep, updateVars]);

  async function handleExecute(id: StepIdValue) {
    const def = steps.find((s) => s.id === id);
    if (!def) return;
    const missing = def.requires.filter((v) => !vars[v]);
    if (missing.length > 0) {
      updateStep(id, {
        status: "failed",
        error: `Missing required vars: ${missing.join(", ")}`
      });
      return;
    }

    setExecuting(id);
    try {
      const result = await runStep(id, vars);
      updateVars(result.newVars);
      updateStep(id, result.state);
    } catch (error) {
      console.error("Failed to run step:", error);
    } finally {
      setExecuting(null);
    }
  }

  function handleUndo(id: StepIdValue) {
    const def = steps.find((s) => s.id === id);
    if (!def) return;
    setStatus((prev) => ({ ...prev, [id]: { status: "idle" } }));
    setVars((prev) => {
      const next = { ...prev };
      for (const v of def.provides) {
        delete (next as Record<string, unknown>)[v];
      }
      return next;
    });
    checkedSteps.current.delete(id);
  }

  function handleForce(id: StepIdValue) {
    console.log("Force execute", id);
    handleExecute(id);
  }

  const completed = steps.filter(
    (s) => status[s.id]?.status === "complete"
  ).length;

  const navbar = (
    <Navbar>
      <NavbarSection>
        <NavbarLabel className="font-semibold">Easy CEP</NavbarLabel>
      </NavbarSection>
    </Navbar>
  );

  const sidebar = (
    <Sidebar>
      <SidebarBody>
        <SidebarSection>
          <SidebarItem current className="cursor-default">
            Workflow
          </SidebarItem>
        </SidebarSection>
      </SidebarBody>
    </Sidebar>
  );

  return (
    <StackedLayout navbar={navbar} sidebar={sidebar}>
      <h1 className="mb-8 text-2xl font-bold text-gray-900">Workflow</h1>
      <p className="mb-6 text-gray-600">
        Run each step to configure the environment.
      </p>
      <div className="mb-4 text-sm text-gray-600">
        {completed} of {steps.length} steps complete
      </div>
      <div className="lg:flex lg:items-start lg:gap-6">
        <div className="flex-1">
          <ProviderLogin onUpdate={updateVars} />
          {steps.map((step, idx) => (
            <StepCard
              key={step.id}
              index={idx}
              definition={step}
              state={status[step.id]}
              vars={vars}
              executing={executing !== null}
              onExecute={handleExecute}
              onUndo={handleUndo}
              onForce={handleForce}
            />
          ))}
        </div>
        <div className="mt-6 lg:mt-0 lg:w-96 lg:flex-none lg:sticky lg:top-4">
          <VarsInspector vars={vars} onChange={updateVars} />
        </div>
      </div>
    </StackedLayout>
  );
}
