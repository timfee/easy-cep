import { useMemo, useState } from "react";

export function usePaginatedItems<T>(items: T[], itemsPerPage: number = 25) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(items.length / itemsPerPage);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return items.slice(start, end);
  }, [items, currentPage, itemsPerPage]);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const reset = () => setCurrentPage(1);

  return {
    currentPage,
    totalPages,
    paginatedItems,
    totalItems: items.length,
    itemsPerPage,
    goToPage,
    goToFirstPage: () => goToPage(1),
    goToLastPage: () => goToPage(totalPages),
    goToNextPage: () => goToPage(currentPage + 1),
    goToPrevPage: () => goToPage(currentPage - 1),
    reset
  };
}
