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
        "flex items-start gap-3 px-4 py-3 text-sm transition-colors",
        failed ? "bg-destructive/10" : "hover:bg-muted/50"
      )}
    >
      {showCheckboxes && item.deletable !== false && (
        <Checkbox
          checked={selectedIds.has(item.id)}
          className="mt-0.5 h-4 w-4"
          disabled={isDeleting}
          onCheckedChange={handleCheckedChange}
        />
      )}
      {item.deletable === false && showCheckboxes && (
        <Lock className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1 space-y-0.5">
        {item.href ? (
          <Link
            className="block truncate text-primary hover:underline"
            href={item.href}
            rel="noopener noreferrer"
            target="_blank"
          >
            {item.label}
          </Link>
        ) : (
          <span className="block truncate text-foreground">
            {item.label}
          </span>
        )}
        {item.subLabel && (
          <span className="block truncate text-muted-foreground text-xs">
            {item.subLabel}
          </span>
        )}
        {failed && (
          <div className="mt-2 flex items-start gap-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
            <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">Failed</Badge>
            <p className="min-w-0 leading-5">
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
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-sm text-muted-foreground">No entries found.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border bg-card">
      <div className="divide-y">
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
