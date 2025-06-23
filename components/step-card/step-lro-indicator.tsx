"use client";
import { Clock, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

interface StepLROIndicatorProps {
  startTime: number;
  estimatedDuration?: number;
  operationType?: string;
}

export function StepLROIndicator({
  startTime,
  estimatedDuration,
  operationType
}: StepLROIndicatorProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const progress =
    estimatedDuration ?
      Math.min((elapsed / estimatedDuration) * 100, 90)
    : null;

  return (
    <div className="my-4 px-6 space-y-3">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-primary">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="font-medium">
            {operationType || "Long-running operation in progress"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-slate-600">
          <Clock className="h-3.5 w-3.5" />
          <span>{formatTime(elapsed)} elapsed</span>
        </div>
      </div>
      {progress !== null && (
        <div className="relative h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-primary transition-all duration-1000 ease-out"
            style={{ width: `${progress}%` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
        </div>
      )}
      {estimatedDuration && elapsed < estimatedDuration && (
        <p className="text-xs text-slate-500 text-center">
          Estimated time remaining: {formatTime(estimatedDuration - elapsed)}
        </p>
      )}
      {estimatedDuration && elapsed > estimatedDuration && (
        <p className="text-xs text-amber-600 text-center">
          Taking longer than expected. This is normal for complex operations.
        </p>
      )}
    </div>
  );
}
