import { StepStatus } from "./step-status";

export const STEP_STATE_CONFIG = {
  [StepStatus.Idle]: {
    badge: {
      variant: "outline" as const,
      className: "bg-slate-100 text-slate-600 border-slate-200"
    },
    icon: null,
    indicatorClass: "bg-slate-600 text-white",
    borderClass: "border-slate-200 hover:border-slate-300"
  },
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
  [StepStatus.Checking]: {
    badge: {
      variant: "default" as const,
      className: "bg-chart-1/10 text-chart-1 border-chart-1/20"
    },
    icon: "Loader2",
    indicatorClass: "bg-chart-1 text-white animate-breathing",
    borderClass: "border-chart-1/30"
  },
  [StepStatus.Executing]: {
    badge: {
      variant: "default" as const,
      className: "bg-chart-1/10 text-chart-1 border-chart-1/20"
    },
    icon: "Loader2",
    indicatorClass: "bg-chart-1 text-white animate-breathing",
    borderClass: "border-chart-1 ring-1 ring-chart-1/30"
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
  [StepStatus.Failed]: {
    badge: {
      variant: "destructive" as const,
      className: "bg-destructive/10 text-destructive border-destructive/20"
    },
    icon: "XCircle",
    indicatorClass: "bg-destructive text-white",
    borderClass: "border-destructive"
  },
  [StepStatus.Pending]: {
    badge: {
      variant: "default" as const,
      className: "bg-chart-1/10 text-chart-1 border-chart-1/20"
    },
    icon: "Clock",
    indicatorClass: "bg-chart-1 text-white",
    borderClass: "border-chart-1"
  },
  [StepStatus.Undoing]: {
    badge: {
      variant: "default" as const,
      className: "bg-chart-1/10 text-chart-1 border-chart-1/20"
    },
    icon: "Loader2",
    indicatorClass: "bg-chart-1 text-white animate-breathing",
    borderClass: "border-chart-1 ring-1 ring-chart-1/30"
  },
  [StepStatus.Reverted]: {
    badge: {
      variant: "outline" as const,
      className: "bg-slate-100 text-slate-700 border-slate-200"
    },
    icon: null,
    indicatorClass: "bg-slate-600 text-white",
    borderClass: "border-slate-300"
  }
} as const;
