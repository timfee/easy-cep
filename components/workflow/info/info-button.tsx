"use client";

import type { ChangeEvent, MouseEvent, ReactNode } from "react";

import { Info, Loader2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { InfoItem } from "@/lib/info";
import type { DeleteResult } from "@/lib/workflow/info-actions";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useInfoItems } from "@/hooks/use-info-items";
import { useMultiSelect } from "@/hooks/use-multi-select";
import { usePaginatedItems } from "@/hooks/use-paginated-items";

import { InfoItemList } from "./info-item-list";

interface InfoButtonProps {
  title: string;
  fetchItems: () => Promise<InfoItem[]>;
  deleteItems?: (ids: string[]) => Promise<DeleteResult>;
  context?: ReactNode;
}

/**
 * Modal button that fetches and manages info items.
 */
export function InfoButton({
  title,
  fetchItems,
  deleteItems,
  context,
}: InfoButtonProps) {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [failedDeletes, setFailedDeletes] = useState<Map<string, string>>(
    new Map()
  );

  const { items, loading, error, refetch } = useInfoItems(fetchItems, open);

  const deletableItems = items.filter((item) => item.deletable !== false);

  const {
    currentPage,
    totalPages,
    paginatedItems,
    goToPage,
    goToNextPage,
    goToPrevPage,
    reset: resetPagination,
  } = usePaginatedItems(items);

  const {
    selectedIds,
    toggleAll,
    toggle,
    reset: resetSelection,
  } = useMultiSelect(paginatedItems);

  const visibleDeletableItems = paginatedItems.filter(
    (item) => item.deletable !== false
  );

  const handleInspectClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
    },
    []
  );

  const handleToggleAllVisible = useCallback(
    () => toggleAll(visibleDeletableItems),
    [toggleAll, visibleDeletableItems]
  );

  const handleDeleteConfirmChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setDeleteConfirmText(event.target.value);
    },
    []
  );

  const handleResetDeleteConfirm = useCallback(() => {
    setDeleteConfirmText("");
  }, []);

  const handlePageClick = useCallback(
    (event: MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
      const pageNumber = Number(event.currentTarget.dataset.page);
      if (!Number.isNaN(pageNumber)) {
        goToPage(pageNumber);
      }
    },
    [goToPage]
  );

  useEffect(() => {
    if (!open) {
      resetSelection();
      resetPagination();
      setFailedDeletes(new Map());
      setDeleteConfirmText("");
    }
  }, [open, resetPagination, resetSelection]);

  const handleDeleteSelected = useCallback(async () => {
    if (!deleteItems || selectedIds.size === 0) {
      return;
    }

    setIsDeleting(true);
    setFailedDeletes(new Map());

    const result = await deleteItems([...selectedIds]);

    await refetch(new AbortController().signal);

    const failures = new Map<string, string>();
    for (const { id, error } of result.failed) {
      failures.set(id, error);
    }
    setFailedDeletes(failures);

    resetSelection();

    setIsDeleting(false);
  }, [deleteItems, refetch, resetSelection, selectedIds]);

  const handlePurgeAll = useCallback(async () => {
    if (!deleteItems || deleteConfirmText !== "DELETE ALL") {
      return;
    }

    setIsDeleting(true);
    setFailedDeletes(new Map());

    try {
      const allDeletableIds = deletableItems.map((item) => item.id);
      const result = await deleteItems(allDeletableIds);

      await refetch(new AbortController().signal);

      const failures = new Map<string, string>();
      for (const { id, error } of result.failed) {
        failures.set(id, error);
      }
      setFailedDeletes(failures);

      resetSelection();
      setDeleteConfirmText("");
      resetPagination();
    } finally {
      setIsDeleting(false);
    }
  }, [
    deleteConfirmText,
    deleteItems,
    deletableItems,
    refetch,
    resetPagination,
    resetSelection,
  ]);

  const handlePurgeAllClick = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      await handlePurgeAll();
    },
    [handlePurgeAll]
  );

  const showPagination = items.length > 25;

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button onClick={handleInspectClick} size="sm" variant="link">
          <Info className="h-3.5 w-3.5" /> Inspect
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-150 max-w-2xl flex-col p-0">
        <div className="space-y-1 border-b px-6 py-4">
          <DialogTitle>{title}</DialogTitle>
          {context && <p className="text-foreground/60 text-xs">{context}</p>}
        </div>

        {deleteItems && deletableItems.length > 0 && (
          <div className="flex items-center justify-between gap-2 border-b px-6 py-2">
            <div className="flex items-center gap-2">
              {visibleDeletableItems.length > 0 && (
                <Checkbox
                  checked={
                    selectedIds.size === visibleDeletableItems.length &&
                    visibleDeletableItems.length > 0
                  }
                  className="h-3 w-3"
                  onCheckedChange={handleToggleAllVisible}
                />
              )}
              <span className="text-foreground/60 text-xs">
                {selectedIds.size} selected
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                className="h-6 px-2 text-xs"
                disabled={selectedIds.size === 0 || isDeleting}
                onClick={handleDeleteSelected}
                size="sm"
                variant="destructive"
              >
                {isDeleting && (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                )}
                Delete Selected
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    className="h-6 px-2 text-xs"
                    disabled={deletableItems.length === 0 || isDeleting}
                    size="sm"
                    variant="destructive"
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Purge All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Purge All {title}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will delete {deletableItems.length} items. This
                      action cannot be undone. Type &quot;DELETE ALL&quot; to
                      confirm.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <Input
                    className="mt-2"
                    disabled={isDeleting}
                    onChange={handleDeleteConfirmChange}
                    placeholder="Type DELETE ALL to confirm"
                    value={deleteConfirmText}
                  />
                  <AlertDialogFooter>
                    <AlertDialogCancel
                      disabled={isDeleting}
                      onClick={handleResetDeleteConfirm}
                    >
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive hover:bg-destructive/90"
                      disabled={
                        deleteConfirmText !== "DELETE ALL" || isDeleting
                      }
                      onClick={handlePurgeAllClick}
                    >
                      {isDeleting && (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      )}
                      Purge All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <p className="p-4 text-foreground/70 text-sm">Loading...</p>
          )}
          {error && <p className="p-4 text-destructive text-sm">{error}</p>}
          {!(loading || error) && (
            <InfoItemList
              failedDeletes={failedDeletes}
              isDeleting={isDeleting}
              items={paginatedItems}
              onToggleSelect={toggle}
              selectedIds={selectedIds}
              showCheckboxes={!!deleteItems}
            />
          )}
        </div>

        {showPagination && (
          <div className="border-t px-6 py-3">
            <div className="flex items-center justify-between">
              <span className="text-foreground/60 text-xs">
                Showing {(currentPage - 1) * 25 + 1}-
                {Math.min(currentPage * 25, items.length)} of {items.length}
              </span>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      className={
                        currentPage === 1
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                      onClick={goToPrevPage}
                    />
                  </PaginationItem>
                  {Array.from(
                    { length: Math.min(totalPages, 5) },
                    (_, i) => i + 1
                  ).map((pageNum) => (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        className="cursor-pointer"
                        data-page={pageNum}
                        isActive={currentPage === pageNum}
                        onClick={handlePageClick}
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      className={
                        currentPage === totalPages
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                      onClick={goToNextPage}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
