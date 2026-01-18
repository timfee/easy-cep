import { useCallback, useEffect, useState } from "react";
import type { InfoItem } from "@/lib/info";

export function useInfoItems(
  fetchItems: () => Promise<InfoItem[]>,
  open: boolean
) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<InfoItem[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(undefined);
      try {
        const res = await fetchItems();
        if (!signal.aborted) {
          setItems(res);
        }
      } catch (err) {
        if (!signal.aborted) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    [fetchItems]
  );

  useEffect(() => {
    if (!open) {
      setItems([]);
      return;
    }

    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [open, load]);

  return { items, loading, error, refetch: load };
}
