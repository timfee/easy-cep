import { useCallback, useEffect, useState } from "react";

import type { InfoItem } from "@/lib/info";

/**
 * Fetch and refresh info items when a dialog is open.
 */
export function useInfoItems(
  fetchItems: () => Promise<InfoItem[]>,
  open: boolean
) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<InfoItem[]>([]);
  const [error, setError] = useState<string | undefined>();

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(undefined);
      try {
        const res = await fetchItems();
        if (!signal.aborted) {
          setItems(res);
        }
      } catch (error) {
        if (!signal.aborted) {
          setError(error instanceof Error ? error.message : String(error));
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

  return { error, items, loading, refetch: load };
}
