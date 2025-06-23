import { StepStatus } from "./step-status";

export const STEP_STATE_CONFIG = {
  [StepStatus.Ready]: {
    badge: {
      variant: "outline" as const,
      className: "bg-green-50 text-green-700 border-green-200"
    },
    icon: null,
    indicatorClass: "bg-green-600 text-white",
    borderClass: "border-green-200 hover:border-green-300"
  },
  [StepStatus.Blocked]: {
    badge: {
      variant: "outline" as const,
      className: "bg-gray-50 text-gray-500 border-gray-200"
    },
    icon: null,
    indicatorClass: "bg-gray-400 text-white",
    borderClass: "border-gray-200"
  },
  [StepStatus.Complete]: {
    badge: {
      variant: "default" as const,
      className: "bg-primary/10 text-primary border-primary/20"
    },
    icon: "CheckCircle",
    indicatorClass: "bg-primary text-white",
    borderClass: "border-primary/20"
  },
  [StepStatus.Stale]: {
    badge: {
      variant: "destructive" as const,
      className: "bg-destructive/10 text-destructive border-destructive/20"
    },
    icon: "AlertTriangle",
    indicatorClass: "bg-destructive text-white",
    borderClass: "border-destructive"
  }
} as const;
