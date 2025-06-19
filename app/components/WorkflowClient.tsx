"use client";

import { checkStep, runStep, undoStep } from "@/lib/workflow/engine";
import { StepIdValue, StepUIState, Var, WorkflowVars } from "@/types";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
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
  const [varsOpen, setVarsOpen] = useState(true);

  // Generate a default password once on the client to avoid SSR mismatches
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      setVars((prev) => ({
        ...prev,
        [Var.GeneratedPassword]: Math.random().toString(36).slice(-12),
        // Add default configuration values
        [Var.AutomationOuName]: "Automation",
        [Var.AutomationOuPath]: "/Automation",
        [Var.ProvisioningUserPrefix]: "azuread-provisioning",
        [Var.AdminRoleName]: "Microsoft Entra Provisioning",
        [Var.SamlProfileDisplayName]: "Azure AD",
        [Var.ProvisioningAppDisplayName]: "Google Workspace Provisioning",
        [Var.SsoAppDisplayName]: "Google Workspace SSO",
        [Var.ClaimsPolicyDisplayName]: "Google Workspace Basic Claims"
      }));
    }
  }, []);

  const updateVars = useCallback((newVars: Partial<WorkflowVars>) => {
    const keys = Object.keys(newVars) as (keyof typeof newVars)[];
    if (keys.length === 0) return;
    let didChange = false;
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
      didChange = true;
      return { ...prev, ...newVars };
    });
    if (didChange) {
      checkedSteps.current.clear();
    }
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
          updateStep(step.id, { status: "checking" });
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
    updateStep(id, { status: "executing" });
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

  async function handleUndo(id: StepIdValue) {
    const def = steps.find((s) => s.id === id);
    if (!def) return;

    setStatus((prev) => ({ ...prev, [id]: { status: "undoing" } }));

    try {
      const result = await undoStep(id, vars);
      updateStep(id, result.state);

      if (result.state.status === "reverted") {
        // Clear provided vars and force a fresh check (step returns to idle)
        setVars((prev) => {
          const next = { ...prev };
          for (const v of def.provides) {
            delete (next as Record<string, unknown>)[v];
          }
          return next;
        });
        checkedSteps.current.delete(id);
        updateStep(id, { status: "idle" });
      }
    } catch (error) {
      console.error("Failed to undo step:", error);
    }
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
      {/* Container for all content - single scroll context */}
      <div className="min-h-screen overflow-x-hidden">
        {/* Header section - fixed width, centered */}
        <div className="mx-auto max-w-2xl px-4 py-6">
          <h1 className="mb-4 text-2xl font-bold text-gray-900">Workflow</h1>
          <p className="mb-6 text-gray-600">
            Run each step to configure the environment.
          </p>
          <div className="mb-6 text-sm text-gray-600">
            {completed} of {steps.length} steps complete
          </div>

          {/* Provider Login - keep in centered container */}
          <ProviderLogin onUpdate={updateVars} />
        </div>

        {/* Steps section - full width for cards */}
        <div className="pb-8">
          {steps.map((step, idx) => (
            <div key={step.id} className="mx-auto max-w-3xl px-4">
              <StepCard
                index={idx}
                definition={step}
                state={status[step.id]}
                vars={vars}
                executing={executing !== null}
                onExecute={handleExecute}
                onUndo={handleUndo}
                onForce={handleForce}
                onVarChange={(k, v) => updateVars({ [k]: v } as Partial<WorkflowVars>)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Variables Panel - fixed position slide-out */}
      <div
        className={clsx(
          "fixed right-0 top-0 h-screen w-64 bg-white border-l border-gray-200 shadow-lg transition-transform duration-300 z-50",
          varsOpen ? "translate-x-0" : "translate-x-full"
        )}
        style={{ maxHeight: "100vh" }}>
        {/* Toggle button attached to panel */}
        <button
          onClick={() => setVarsOpen(!varsOpen)}
          className="absolute -left-12 top-1/2 -translate-y-1/2 bg-white border border-gray-200 rounded-l-lg p-1.5 shadow-sm hover:shadow-md transition-shadow">
          {varsOpen ?
            <ChevronRightIcon className="h-4 w-4 text-gray-500" />
          : <ChevronLeftIcon className="h-4 w-4 text-gray-500" />}
        </button>

        <VarsInspector vars={vars} onChange={updateVars} />
      </div>
    </StackedLayout>
  );
}
