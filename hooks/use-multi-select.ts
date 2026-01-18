import { useCallback, useState } from "react";

export function useMultiSelect<T extends { id: string }>(_items: T[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const selectAll = useCallback((selectItems: T[]) => {
    setSelectedIds(new Set(selectItems.map((item) => item.id)));
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleAll = useCallback(
    (selectItems: T[]) => {
      if (selectedIds.size === selectItems.length) {
        deselectAll();
      } else {
        selectAll(selectItems);
      }
    },
    [selectedIds, selectAll, deselectAll]
  );

  const select = useCallback((id: string) => {
    setSelectedIds((prev) => new Set(prev).add(id));
  }, []);

  const deselect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    isSelected: (id: string) => selectedIds.has(id),
    selectAll,
    deselectAll,
    toggleAll,
    select,
    deselect,
    toggle,
    reset,
  };
}
