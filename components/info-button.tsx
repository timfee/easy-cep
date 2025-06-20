"use client";

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
import { Info, Loader2, Lock, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

export interface InfoItem {
  id: string;
  label: string;
  subLabel?: string;
  href?: string;
  deletable?: boolean;
}

export interface DeleteResult {
  deleted: string[];
  failed: Array<{ id: string; error: string }>;
}

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
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<InfoItem[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [failedDeletes, setFailedDeletes] = useState<Map<string, string>>(
    new Map()
  );

  const itemsPerPage = 25;

  useEffect(() => {
    if (!open) {
      setSelectedIds(new Set());
      setCurrentPage(1);
      setFailedDeletes(new Map());
      return;
    }

    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(undefined);
      try {
        const res = await fetchItems();
        if (!controller.signal.aborted) {
          setItems(res);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    load();
    return () => controller.abort();
  }, [open, fetchItems]);

  const paginatedItems = items.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(items.length / itemsPerPage);
  const showPagination = items.length > itemsPerPage;

  const deletableItems = items.filter((item) => item.deletable !== false);
  const visibleDeletableItems = paginatedItems.filter(
    (item) => item.deletable !== false
  );

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === visibleDeletableItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleDeletableItems.map((item) => item.id)));
    }
  }, [selectedIds, visibleDeletableItems]);

  const handleSelectItem = useCallback(
    (id: string, checked: boolean) => {
      const newSelected = new Set(selectedIds);
      if (checked) {
        newSelected.add(id);
      } else {
        newSelected.delete(id);
      }
      setSelectedIds(newSelected);
    },
    [selectedIds]
  );

  const handlePageChange = (page: number) => {
    setSelectedIds(new Set());
    setCurrentPage(page);
  };

  const handleDeleteSelected = async () => {
    if (!deleteItems || selectedIds.size === 0) return;

    setIsDeleting(true);
    setFailedDeletes(new Map());

    try {
      const result = await deleteItems(Array.from(selectedIds));

      setItems((prev) =>
        prev.filter((item) => !result.deleted.includes(item.id))
      );
      setSelectedIds(new Set());

      const failures = new Map<string, string>();
      result.failed.forEach(({ id, error }) => {
        failures.set(id, error);
      });
      setFailedDeletes(failures);

      const newTotal = items.length - result.deleted.length;
      const newTotalPages = Math.ceil(newTotal / itemsPerPage);
      if (currentPage > newTotalPages) {
        setCurrentPage(1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete operation failed");
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

      setItems((prev) =>
        prev.filter((item) => !result.deleted.includes(item.id))
      );
      setSelectedIds(new Set());
      setDeleteConfirmText("");
      setCurrentPage(1);

      const failures = new Map<string, string>();
      result.failed.forEach(({ id, error }) => {
        failures.set(id, error);
      });
      setFailedDeletes(failures);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Purge operation failed");
    } finally {
      setIsDeleting(false);
    }
  };

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
                  onCheckedChange={handleSelectAll}
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
                        setOpen(false);
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
            <div className="space-y-1 py-2">
              {paginatedItems.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded ${
                    failedDeletes.has(item.id) ? "bg-red-50" : ""
                  }`}>
                  {deleteItems && item.deletable !== false && (
                    <Checkbox
                      checked={selectedIds.has(item.id)}
                      onCheckedChange={(checked) =>
                        handleSelectItem(item.id, !!checked)
                      }
                      disabled={isDeleting}
                      className="h-3 w-3"
                    />
                  )}
                  {item.deletable === false && deleteItems && (
                    <Lock className="h-3 w-3 text-slate-400" />
                  )}
                  <div className="flex-1 min-w-0">
                    {item.href ?
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline truncate block">
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
                      <span className="text-xs text-red-600">
                        Failed: {failedDeletes.get(item.id)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <p className="text-slate-600 text-xs text-center py-4">
                  No entries found.
                </p>
              )}
            </div>
          )}
        </div>

        {showPagination && (
          <div className="border-t pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-600">
                Showing {(currentPage - 1) * itemsPerPage + 1}-
                {Math.min(currentPage * itemsPerPage, items.length)} of{" "}
                {items.length}
              </span>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() =>
                        handlePageChange(Math.max(1, currentPage - 1))
                      }
                      className={
                        currentPage === 1 ?
                          "pointer-events-none opacity-50"
                        : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const pageNum = i + 1;
                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          onClick={() => handlePageChange(pageNum)}
                          isActive={currentPage === pageNum}
                          className="cursor-pointer">
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() =>
                        handlePageChange(Math.min(totalPages, currentPage + 1))
                      }
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
