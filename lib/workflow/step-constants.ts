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
      className: "bg-blue-100 text-blue-800 border-blue-200"
    },
    icon: "Loader2",
    indicatorClass: "bg-blue-500 text-white animate-breathing",
    borderClass: "border-blue-300"
  },
  executing: {
    badge: {
      variant: "default" as const,
      className: "bg-blue-100 text-blue-800 border-blue-200"
    },
    icon: "Loader2",
    indicatorClass: "bg-blue-500 text-white animate-breathing",
    borderClass: "border-blue-400 ring-1 ring-blue-300"
  },
  complete: {
    badge: {
      variant: "default" as const,
      className: "bg-green-100 text-green-800 border-green-200"
    },
    icon: "CheckCircle",
    indicatorClass: "bg-green-500 text-white",
    borderClass: "border-green-400"
  },
  failed: {
    badge: {
      variant: "destructive" as const,
      className: "bg-red-100 text-red-800 border-red-200"
    },
    icon: "XCircle",
    indicatorClass: "bg-red-500 text-white",
    borderClass: "border-red-400"
  },
  pending: {
    badge: {
      variant: "default" as const,
      className: "bg-amber-100 text-amber-800 border-amber-200"
    },
    icon: "Clock",
    indicatorClass: "bg-amber-500 text-white",
    borderClass: "border-amber-400"
  },
  undoing: {
    badge: {
      variant: "default" as const,
      className: "bg-amber-100 text-amber-800 border-amber-200"
    },
    icon: "Loader2",
    indicatorClass: "bg-amber-500 text-white animate-breathing",
    borderClass: "border-amber-400 ring-1 ring-amber-300"
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
