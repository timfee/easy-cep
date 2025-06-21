export const STEP_STATE_CONFIG = {
  idle: {
    badge: {
      variant: "outline" as const,
      className: "bg-slate-100 text-slate-600 border-slate-200"
    },
    icon: null,
    indicatorClass: "bg-slate-600 text-white",
    borderClass: "border-slate-200 hover:border-slate-300"
  },
  checking: {
    badge: {
      variant: "default" as const,
      className: "bg-primary/10 text-primary border-primary/20"
    },
    icon: "Loader2",
    indicatorClass: "bg-primary text-white animate-breathing",
    borderClass: "border-primary/30"
  },
  executing: {
    badge: {
      variant: "default" as const,
      className: "bg-primary/10 text-primary border-primary/20"
    },
    icon: "Loader2",
    indicatorClass: "bg-primary text-white animate-breathing",
    borderClass: "border-primary ring-1 ring-primary/30"
  },
  complete: {
    badge: {
      variant: "default" as const,
      className: "bg-secondary/10 text-secondary border-secondary/20"
    },
    icon: "CheckCircle",
    indicatorClass: "bg-secondary text-white",
    borderClass: "border-secondary"
  },
  failed: {
    badge: {
      variant: "destructive" as const,
      className: "bg-destructive/10 text-destructive border-destructive/20"
    },
    icon: "XCircle",
    indicatorClass: "bg-destructive text-white",
    borderClass: "border-destructive"
  },
  pending: {
    badge: {
      variant: "default" as const,
      className: "bg-chart-1/10 text-chart-1 border-chart-1/20"
    },
    icon: "Clock",
    indicatorClass: "bg-chart-1 text-white",
    borderClass: "border-chart-1"
  },
  undoing: {
    badge: {
      variant: "default" as const,
      className: "bg-chart-1/10 text-chart-1 border-chart-1/20"
    },
    icon: "Loader2",
    indicatorClass: "bg-chart-1 text-white animate-breathing",
    borderClass: "border-chart-1 ring-1 ring-chart-1/30"
  },
  reverted: {
    badge: {
      variant: "outline" as const,
      className: "bg-slate-100 text-slate-700 border-slate-200"
    },
    icon: null,
    indicatorClass: "bg-slate-600 text-white",
    borderClass: "border-slate-300"
  }
} as const;
