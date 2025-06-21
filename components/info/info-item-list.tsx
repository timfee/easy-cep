import { Checkbox } from "@/components/ui/checkbox";
import { InfoItem } from "@/lib/info";
import { Lock } from "lucide-react";

interface InfoItemListProps {
  items: InfoItem[];
  selectedIds: Set<string>;
  failedDeletes: Map<string, string>;
  onToggleSelect: (id: string) => void;
  isDeleting: boolean;
  showCheckboxes: boolean;
}

export function InfoItemList({
  items,
  selectedIds,
  failedDeletes,
  onToggleSelect,
  isDeleting,
  showCheckboxes
}: InfoItemListProps) {
  if (items.length === 0) {
    return (
      <p className="text-slate-600 text-xs text-center py-4">
        No entries found.
      </p>
    );
  }

  return (
    <div className="space-y-1 py-2">
      {items.map((item) => (
        <div
          key={item.id}
          className={`flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded ${
            failedDeletes.has(item.id) ? "bg-destructive/10" : ""
          }`}>
          {showCheckboxes && item.deletable !== false && (
            <Checkbox
              checked={selectedIds.has(item.id)}
              onCheckedChange={() => onToggleSelect(item.id)}
              disabled={isDeleting}
              className="h-3 w-3"
            />
          )}
          {item.deletable === false && showCheckboxes && (
            <Lock className="h-3 w-3 text-slate-400" />
          )}
          <div className="flex-1 min-w-0">
            {item.href ?
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline truncate block">
                {item.label}
              </a>
            : <span className="text-xs text-slate-700 truncate block">
                {item.label}
              </span>
            }
            {item.subLabel && (
              <span className="text-xs text-slate-500 truncate block">
                {item.subLabel}
              </span>
            )}
            {failedDeletes.has(item.id) && (
              <span className="text-xs text-destructive">
                Failed: {failedDeletes.get(item.id)}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
