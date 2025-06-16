import { StepId } from "@/types";
import verifyPrimaryDomain from "./steps/verify-primary-domain";

const allSteps = [verifyPrimaryDomain] as const;

export function getAllSteps() {
  return allSteps;
}

export function getStep<T extends StepId>(
  id: T
): Extract<(typeof allSteps)[number], { id: T }> {
  const match = allSteps.find(
    (s): s is Extract<(typeof allSteps)[number], { id: T }> => s.id === id
  );
  if (!match) throw new Error(`Step "${id}" not found in registry`);
  return match;
}
