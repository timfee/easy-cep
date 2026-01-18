import { useCallback, useMemo, useState } from "react";

/**
 * Provide pagination helpers for a list.
 */
export function usePaginatedItems<T>(items: T[], itemsPerPage = 25) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(items.length / itemsPerPage);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return items.slice(start, end);
  }, [items, currentPage, itemsPerPage]);

  const goToPage = useCallback(
    (page: number) => {
      setCurrentPage(
        Math.max(1, Math.min(page, Math.ceil(items.length / itemsPerPage)))
      );
    },
    [items.length, itemsPerPage]
  );

  const goToFirstPage = useCallback(() => goToPage(1), [goToPage]);
  const goToLastPage = useCallback(
    () => goToPage(totalPages),
    [goToPage, totalPages]
  );
  const goToNextPage = useCallback(
    () => goToPage(currentPage + 1),
    [goToPage, currentPage]
  );
  const goToPrevPage = useCallback(
    () => goToPage(currentPage - 1),
    [goToPage, currentPage]
  );

  const reset = useCallback(() => setCurrentPage(1), []);

  return {
    currentPage,
    totalPages,
    paginatedItems,
    totalItems: items.length,
    itemsPerPage,
    goToPage,
    goToFirstPage,
    goToLastPage,
    goToNextPage,
    goToPrevPage,
    reset,
  };
}
