import { Lock } from "lucide-react";
import Link from "next/link";
import { useCallback } from "react";

import type { InfoItem } from "@/lib/info";

import { Badge } from "@/components/ui/badge";
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

interface InfoItemRowProps {
  item: InfoItem;
  showCheckboxes: boolean;
  selectedIds: Set<string>;
  failedDeletes: Map<string, string>;
  isDeleting: boolean;
  onToggleSelect: (id: string) => void;
}

/**
 * Render a list of info items with selection state.
 */
function InfoItemRow({
  item,
  showCheckboxes,
  selectedIds,
  failedDeletes,
  isDeleting,
  onToggleSelect,
}: InfoItemRowProps) {
  const handleCheckedChange = useCallback(() => {
    onToggleSelect(item.id);
  }, [item.id, onToggleSelect]);

  const failed = failedDeletes.has(item.id);

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3 text-xs transition-colors",
        failed ? "bg-destructive/10" : "hover:bg-muted/70"
      )}
    >
      {showCheckboxes && item.deletable !== false && (
        <Checkbox
          checked={selectedIds.has(item.id)}
          className="h-3 w-3"
          disabled={isDeleting}
          onCheckedChange={handleCheckedChange}
        />
      )}
      {item.deletable === false && showCheckboxes && (
        <Lock className="h-3 w-3 text-foreground/60" />
      )}
      <div className="min-w-0 flex-1">
        {item.href ? (
          <Link
            className="block truncate text-primary text-xs hover:underline"
            href={item.href}
            rel="noopener noreferrer"
            target="_blank"
          >
            {item.label}
          </Link>
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
        {failed && (
          <div className="mt-1 flex items-start gap-2 text-[11px] text-destructive/80">
            <Badge variant="destructive">Failed</Badge>
            <p className="min-w-0 text-destructive/80">
              {failedDeletes.get(item.id)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

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
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
      <div className="divide-y divide-border/70">
        {items.map((item, idx) => (
          <InfoItemRow
            key={`${item.id}-${idx}`}
            item={item}
            showCheckboxes={showCheckboxes}
            selectedIds={selectedIds}
            failedDeletes={failedDeletes}
            isDeleting={isDeleting}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </div>
    </div>
  );
}
