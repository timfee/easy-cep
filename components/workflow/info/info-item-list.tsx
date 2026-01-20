import { Lock } from "lucide-react";

import type { InfoItem } from "@/lib/info";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface InfoItemListProps {
  items: InfoItem[];
  selectedIds: Set<string>;
  failedDeletes: Map<string, string>;
  onToggleSelect: (id: string) => void;
  isDeleting: boolean;
  showCheckboxes: boolean;
}

/**
 * Render a list of info items with selection state.
 */
export function InfoItemList({
  items,
  selectedIds,
  failedDeletes,
  onToggleSelect,
  isDeleting,
  showCheckboxes,
}: InfoItemListProps) {
  if (items.length === 0) {
    return (
      <p className="py-4 text-center text-[11px] text-foreground/60">
        No entries found.
      </p>
    );
  }

  return (
    <div className="divide-y divide-border/70">
      {items.map((item, idx) => (
        <div
          className={cn(
            "flex items-start gap-2 rounded-md px-3 py-2 transition-colors hover:bg-muted/60",
            failedDeletes.has(item.id) && "bg-destructive/10"
          )}
          key={`${item.id}-${idx}`}
        >
          {showCheckboxes && item.deletable !== false && (
            <Checkbox
              checked={selectedIds.has(item.id)}
              className="h-3 w-3"
              disabled={isDeleting}
              onCheckedChange={() => onToggleSelect(item.id)}
            />
          )}
          {item.deletable === false && showCheckboxes && (
            <Lock className="h-3 w-3 text-foreground/60" />
          )}
          <div className="min-w-0 flex-1">
            {item.href ? (
              <a
                className="block truncate text-primary text-xs hover:underline"
                href={item.href}
                rel="noopener noreferrer"
                target="_blank"
              >
                {item.label}
              </a>
            ) : (
              <span className="block truncate text-foreground text-xs">
                {item.label}
              </span>
            )}
            {item.subLabel && (
              <span className="block truncate text-foreground/75 text-xs">
                {item.subLabel}
              </span>
            )}
            {failedDeletes.has(item.id) && (
              <span className="text-[11px] text-destructive">
                Failed: {failedDeletes.get(item.id)}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
