"use client";

import type { ChangeEvent, MouseEvent, ReactNode } from "react";

import { AlertTriangle, Info, Loader2, Trash2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
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

interface InfoCalloutProps {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  variant?: "info" | "error";
}

function InfoCallout({
  title,
  description,
  icon,
  variant = "info",
}: InfoCalloutProps) {
  const variantClasses =
    variant === "error"
      ? "border border-destructive/60 bg-destructive/10 text-destructive"
      : "border border-primary/60 bg-primary/10 text-primary-foreground";

  const iconNode =
    icon ??
    (variant === "error" ? (
      <AlertTriangle className="h-4 w-4" aria-hidden />
    ) : (
      <Info className="h-4 w-4" aria-hidden />
    ));

  return (
    <div
      className={`flex gap-3 rounded-lg px-4 py-3 text-sm ${variantClasses}`}
    >
      <div className="flex h-5 w-5 items-center justify-center text-current">
        {iconNode}
      </div>
      <div className="min-w-0 space-y-1">
        <p className="font-semibold leading-tight text-sm">{title}</p>
        {description && (
          <div className="text-xs leading-relaxed text-current/80">
            {description}
          </div>
        )}
      </div>
    </div>
  );
}

interface FailureDetail {
  id: string;
  label: string;
  message: string;
}

interface InfoCalloutsProps {
  error?: string;
  failureDetails: FailureDetail[];
}

function InfoCallouts({ error, failureDetails }: InfoCalloutsProps) {
  if (!error && failureDetails.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 px-6 py-4">
      {error && (
        <InfoCallout
          variant="error"
          title="Unable to load entries"
          description={error}
        />
      )}
      {failureDetails.length > 0 && (
        <InfoCallout
          variant="error"
          title="Some deletions failed"
          description={
            <ul className="space-y-1">
              {failureDetails.map((failure) => (
                <li
                  key={failure.id}
                  className="flex items-start gap-2 text-[11px] text-destructive"
                >
                  <Badge variant="destructive">Failed</Badge>
                  <div className="min-w-0">
                    <p className="text-foreground text-xs font-semibold">
                      {failure.label}
                    </p>
                    <p className="text-destructive/80 text-[11px]">
                      {failure.message}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          }
        />
      )}
    </div>
  );
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

  const labelById = new Map(items.map((item) => [item.id, item.label]));
  const failureDetails = [...failedDeletes.entries()].map(([id, message]) => ({
    id,
    label: labelById.get(id) ?? id,
    message,
  }));
  const showSelectionToolbar = Boolean(
    deleteItems && deletableItems.length > 0
  );
  const showPagination = items.length > 25;

  const selectAllChecked =
    visibleDeletableItems.length > 0 &&
    selectedIds.size === visibleDeletableItems.length;
  const listContent = (() => {
    if (loading) {
      return (
        <InfoCallout
          title="Refreshing entries"
          description="Hang tight while we refresh the list."
          icon={
            <Loader2
              className="h-4 w-4 animate-spin text-current"
              aria-hidden
            />
          }
          variant="info"
        />
      );
    }

    if (paginatedItems.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/50 px-4 py-6 text-center text-xs text-foreground/60">
          No entries found.
        </div>
      );
    }

    return (
      <InfoItemList
        failedDeletes={failedDeletes}
        isDeleting={isDeleting}
        items={paginatedItems}
        onToggleSelect={toggle}
        selectedIds={selectedIds}
        showCheckboxes={!!deleteItems}
      />
    );
  })();

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button onClick={handleInspectClick} size="sm" variant="link">
          <Info className="h-3.5 w-3.5" /> Inspect
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] w-[min(92vw,52rem)] p-0">
        <div className="flex h-full max-h-[90vh] flex-col">
          <div className="border-b px-6 py-5">
            <DialogHeader className="gap-2">
              <DialogTitle>{title}</DialogTitle>
              {context && (
                <DialogDescription className="text-sm text-foreground/70">
                  {context}
                </DialogDescription>
              )}
            </DialogHeader>
          </div>

          {showSelectionToolbar && (
            <div className="border-b px-6 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-foreground/60">
                  {visibleDeletableItems.length > 0 && (
                    <Checkbox
                      checked={selectAllChecked}
                      className="h-3 w-3"
                      onCheckedChange={handleToggleAllVisible}
                    />
                  )}
                  <span>
                    {selectedIds.size} selected · {deletableItems.length}{" "}
                    deletable
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    className="h-8 px-3 text-xs font-semibold"
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
                        className="h-8 px-3 text-xs font-semibold"
                        disabled={deletableItems.length === 0 || isDeleting}
                        size="sm"
                        variant="destructive"
                      >
                        <Trash2 className="mr-1 h-3 w-3" /> Purge All
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Purge All {title}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will delete {deletableItems.length} items. This
                          action cannot be undone. Type &quot;DELETE ALL&quot;
                          to confirm.
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
              <p className="mt-1 text-xs text-foreground/60">
                {selectedIds.size > 0
                  ? "Deletes run immediately and cannot be undone."
                  : "Select entries to enable destructive actions."}
              </p>
            </div>
          )}

          <InfoCallouts error={error} failureDetails={failureDetails} />

          <div className="flex-1 overflow-y-auto px-6 py-4">{listContent}</div>

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

          <DialogFooter className="border-t px-6 py-4">
            <DialogClose asChild>
              <Button size="sm" variant="ghost">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
