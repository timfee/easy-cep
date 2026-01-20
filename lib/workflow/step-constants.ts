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
    borderClass: "border-border/30 border-dashed",
    icon: null,
    indicatorClass: "bg-muted text-muted-foreground/60",
  },
  complete: {
    badge: {
      variant: "outline",
      className: "bg-accent/50 text-accent-foreground border-accent/60",
    },
    borderClass: "border-accent/60",
    icon: "CheckCircle",
    indicatorClass: "bg-accent text-accent-foreground",
  },
  pending: {
    badge: {
      variant: "default",
      className: "bg-amber-500/15 text-amber-700 border-amber-500/40",
    },
    borderClass: "border-amber-500/60 hover:border-amber-500/80",
    icon: null,
    indicatorClass: "bg-amber-500 text-white",
  },
  ready: {
    badge: {
      variant: "default",
      className: "bg-primary/15 text-primary border-primary/40",
    },
    borderClass: "border-primary/60 hover:border-primary/80",
    icon: null,
    indicatorClass: "bg-primary text-primary-foreground",
  },
  stale: {
    badge: {
      variant: "destructive",
      className: "bg-destructive/10 text-destructive border-destructive/20",
    },
    borderClass: "border-destructive",
    icon: "AlertTriangle",
    indicatorClass: "bg-destructive text-white",
  },
};

/**
 * Visual styles for each step status.
 */
export const STEP_STATE_CONFIG = stepStateConfig;
