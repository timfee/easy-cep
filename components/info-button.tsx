"use client";

import { InfoItemList } from "@/components/info-item-list";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from "@/components/ui/pagination";
import { useInfoItems } from "@/hooks/use-info-items";
import { useMultiSelect } from "@/hooks/use-multi-select";
import { usePaginatedItems } from "@/hooks/use-paginated-items";
import type { InfoItem } from "@/lib/info";
import type { DeleteResult } from "@/lib/workflow/info-actions";
import { Info, Loader2, Trash2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

interface InfoButtonProps {
  title: string;
  fetchItems: () => Promise<InfoItem[]>;
  deleteItems?: (ids: string[]) => Promise<DeleteResult>;
  context?: ReactNode;
}

export function InfoButton({
  title,
  fetchItems,
  deleteItems,
  context
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
    reset: resetPagination
  } = usePaginatedItems(items);

  const {
    selectedIds,
    toggleAll,
    toggle,
    reset: resetSelection
  } = useMultiSelect(paginatedItems);

  const visibleDeletableItems = paginatedItems.filter(
    (item) => item.deletable !== false
  );

  useEffect(() => {
    if (!open) {
      resetSelection();
      resetPagination();
      setFailedDeletes(new Map());
      setDeleteConfirmText("");
    }
  }, [open, resetSelection, resetPagination]);

  const handleDeleteSelected = async () => {
    if (!deleteItems || selectedIds.size === 0) return;

    setIsDeleting(true);
    setFailedDeletes(new Map());

    try {
      const result = await deleteItems(Array.from(selectedIds));

      await refetch(new AbortController().signal);

      const failures = new Map<string, string>();
      result.failed.forEach(({ id, error }: { id: string; error: string }) => {
        failures.set(id, error);
      });
      setFailedDeletes(failures);

      resetSelection();
    } catch {
      // ignore errors here
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePurgeAll = async () => {
    if (!deleteItems || deleteConfirmText !== "DELETE ALL") return;

    setIsDeleting(true);
    setFailedDeletes(new Map());

    try {
      const allDeletableIds = deletableItems.map((item) => item.id);
      const result = await deleteItems(allDeletableIds);

      await refetch(new AbortController().signal);

      const failures = new Map<string, string>();
      result.failed.forEach(({ id, error }: { id: string; error: string }) => {
        failures.set(id, error);
      });
      setFailedDeletes(failures);

      resetSelection();
      setDeleteConfirmText("");
      resetPagination();
    } catch {
      // ignore errors
    } finally {
      setIsDeleting(false);
    }
  };

  const showPagination = items.length > 25;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => e.stopPropagation()}
          className="border-slate-300 text-slate-700">
          <Info className="h-3.5 w-3.5 mr-1.5" /> Inspect
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {context && <p className="text-xs text-slate-600 mt-1">{context}</p>}
        </DialogHeader>

        {deleteItems && deletableItems.length > 0 && (
          <div className="flex items-center justify-between gap-2 px-1 py-2 border-b">
            <div className="flex items-center gap-3">
              {visibleDeletableItems.length > 0 && (
                <Checkbox
                  checked={
                    selectedIds.size === visibleDeletableItems.length
                    && visibleDeletableItems.length > 0
                  }
                  onCheckedChange={() => toggleAll(visibleDeletableItems)}
                  className="h-3 w-3"
                />
              )}
              <span className="text-xs text-slate-600">
                {selectedIds.size} selected
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="destructive"
                disabled={selectedIds.size === 0 || isDeleting}
                onClick={handleDeleteSelected}
                className="h-6 text-xs px-2">
                {isDeleting && (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                )}
                Delete Selected
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={deletableItems.length === 0 || isDeleting}
                    className="h-6 text-xs px-2">
                    <Trash2 className="h-3 w-3 mr-1" />
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
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="Type DELETE ALL to confirm"
                    className="mt-2"
                    disabled={isDeleting}
                  />
                  <AlertDialogFooter>
                    <AlertDialogCancel
                      onClick={() => setDeleteConfirmText("")}
                      disabled={isDeleting}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async (e) => {
                        e.preventDefault();
                        await handlePurgeAll();
                      }}
                      disabled={
                        deleteConfirmText !== "DELETE ALL" || isDeleting
                      }
                      className="bg-red-600 hover:bg-red-700">
                      {isDeleting && (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      )}
                      Purge All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading && <p className="text-sm text-slate-600 p-4">Loading...</p>}
          {error && <p className="text-sm text-red-600 p-4">{error}</p>}
          {!loading && !error && (
            <InfoItemList
              items={paginatedItems}
              selectedIds={selectedIds}
              failedDeletes={failedDeletes}
              onToggleSelect={toggle}
              isDeleting={isDeleting}
              showCheckboxes={!!deleteItems}
            />
          )}
        </div>

        {showPagination && (
          <div className="border-t pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-600">
                Showing {(currentPage - 1) * 25 + 1}-
                {Math.min(currentPage * 25, items.length)} of {items.length}
              </span>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={goToPrevPage}
                      className={
                        currentPage === 1 ?
                          "pointer-events-none opacity-50"
                        : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                  {Array.from(
                    { length: Math.min(totalPages, 5) },
                    (_, i) => i + 1
                  ).map((pageNum) => (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        onClick={() => goToPage(pageNum)}
                        isActive={currentPage === pageNum}
                        className="cursor-pointer">
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      onClick={goToNextPage}
                      className={
                        currentPage === totalPages ?
                          "pointer-events-none opacity-50"
                        : "cursor-pointer"
                      }
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
