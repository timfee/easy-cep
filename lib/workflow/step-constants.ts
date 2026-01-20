import type { StepStatus } from "./step-status";

/**
 * Badge variants supported by step state styles.
 */
type BadgeVariant = "outline" | "default" | "destructive";

interface StepStateConfig {
  badge: { variant: BadgeVariant; className: string };
  icon: "CheckCircle" | "AlertTriangle" | null;
  indicatorClass: string;
  borderClass: string;
}

const stepStateConfig: Record<StepStatus, StepStateConfig> = {
  blocked: {
    badge: {
      variant: "outline",
      className: "bg-muted/20 text-muted-foreground/70 border-border/30",
    },
    icon: null,
    indicatorClass: "bg-muted text-muted-foreground/60",
    borderClass: "border-border/30 border-dashed",
  },
  ready: {
    badge: {
      variant: "default",
      className: "bg-primary/15 text-primary border-primary/40",
    },
    icon: null,
    indicatorClass: "bg-primary text-primary-foreground",
    borderClass: "border-primary/60 hover:border-primary/80",
  },
  complete: {
    badge: {
      variant: "outline",
      className: "bg-accent/50 text-accent-foreground border-accent/60",
    },
    icon: "CheckCircle",
    indicatorClass: "bg-accent text-accent-foreground",
    borderClass: "border-accent/60",
  },
  stale: {
    badge: {
      variant: "destructive",
      className: "bg-destructive/10 text-destructive border-destructive/20",
    },
    icon: "AlertTriangle",
    indicatorClass: "bg-destructive text-white",
    borderClass: "border-destructive",
  },
  pending: {
    badge: {
      variant: "default",
      className: "bg-amber-500/15 text-amber-700 border-amber-500/40",
    },
    icon: null,
    indicatorClass: "bg-amber-500 text-white",
    borderClass: "border-amber-500/60 hover:border-amber-500/80",
  },
};

/**
 * Visual styles for each step status.
 */
export const STEP_STATE_CONFIG = stepStateConfig;
