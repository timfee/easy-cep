"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Info } from "lucide-react";
import { useEffect, useState } from "react";

export interface InfoItem {
  id: string;
  label: string;
  href?: string;
  deletable?: boolean;
  deleteEndpoint?: string;
}

interface InfoButtonProps {
  title: string;
  fetchItems: () => Promise<InfoItem[]>;
  deleteItems?: (
    ids: string[]
  ) => Promise<{
    deleted: string[];
    failed: Array<{ id: string; error: string }>;
  }>;
}

export function InfoButton({
  title,
  fetchItems,
  deleteItems
}: InfoButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<InfoItem[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [isDeleting, setIsDeleting] = useState(false);
  const itemsPerPage = 25;

  useEffect(() => {
    if (!open) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(undefined);
      try {
        const res = await fetchItems();
        if (active) setItems(res);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [open, fetchItems]);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [purgeConfirmOpen, setPurgeConfirmOpen] = useState(false);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const pageItems = items.slice(startIndex, startIndex + itemsPerPage);

  const toggleSelectAll = (checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      for (const item of pageItems)
        if (item.deletable !== false) newSet.add(item.id);
    } else {
      for (const item of pageItems) newSet.delete(item.id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelect = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) newSet.add(id);
    else newSet.delete(id);
    setSelectedIds(newSet);
  };

  const handleDelete = async (ids: string[]) => {
    if (!deleteItems) return;
    setIsDeleting(true);
    try {
      const result = await deleteItems(ids);
      const remaining = items.filter((i) => !result.deleted.includes(i.id));
      setItems(remaining);
      setSelectedIds(new Set());
      if (startIndex >= remaining.length && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const allVisibleSelected = pageItems
    .filter((i) => i.deletable !== false)
    .every((i) => selectedIds.has(i.id));

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!isDeleting) {
          setOpen(v);
          if (!v) setSelectedIds(new Set());
        }
      }}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={loading}
          className="border-slate-300 text-slate-700">
          <Info className="h-3.5 w-3.5 mr-1.5" /> Info
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-md max-h-[600px]"
        showCloseButton={!isDeleting}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {loading && (
          <ul className="space-y-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="h-4 bg-slate-200 animate-pulse rounded" />
            ))}
          </ul>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && !error && (
          <>
            <div className="flex items-center gap-2 pb-2 border-b">
              <Checkbox
                className="h-3 w-3"
                checked={allVisibleSelected}
                onCheckedChange={(c) => toggleSelectAll(Boolean(c))}
              />
              <span className="text-xs text-slate-600 flex-1">
                {selectedIds.size} selected
              </span>
              <Button
                size="sm"
                variant="destructive"
                className="text-xs h-6"
                disabled={selectedIds.size === 0 || isDeleting || !deleteItems}
                onClick={() => setConfirmDeleteOpen(true)}>
                Delete Selected
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-6"
                disabled={items.length === 0 || isDeleting || !deleteItems}
                onClick={() => setPurgeConfirmOpen(true)}>
                Purge All
              </Button>
            </div>
            <ul className="space-y-1 my-2">
              {pageItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-2 py-1 px-2 text-xs">
                  {item.deletable !== false && (
                    <Checkbox
                      className="h-3 w-3"
                      checked={selectedIds.has(item.id)}
                      onCheckedChange={(c) => toggleSelect(item.id, Boolean(c))}
                    />
                  )}
                  <span className="flex-1">
                    {item.href ?
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline">
                        {item.label}
                      </a>
                    : item.label}
                    {item.deletable === false && (
                      <span className="ml-1 text-slate-400">🔒</span>
                    )}
                  </span>
                </li>
              ))}
              {pageItems.length === 0 && (
                <li className="py-1 px-2 text-xs text-slate-600">
                  No entries found.
                </li>
              )}
            </ul>
            {items.length > itemsPerPage && (
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-xs text-slate-600">
                  Showing {startIndex + 1}-
                  {Math.min(startIndex + itemsPerPage, items.length)} of{" "}
                  {items.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    className={buttonVariants({ variant: "ghost", size: "sm" })}
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}>
                    Prev
                  </button>
                  <button
                    className={buttonVariants({ variant: "ghost", size: "sm" })}
                    onClick={() =>
                      setCurrentPage(
                        Math.min(
                          Math.ceil(items.length / itemsPerPage),
                          currentPage + 1
                        )
                      )
                    }
                    disabled={
                      currentPage >= Math.ceil(items.length / itemsPerPage)
                    }>
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        <AlertDialog
          open={confirmDeleteOpen}
          onOpenChange={setConfirmDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete {selectedIds.size} items?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setConfirmDeleteOpen(false);
                  handleDelete(Array.from(selectedIds));
                }}>
                Delete {selectedIds.size} items
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={purgeConfirmOpen} onOpenChange={setPurgeConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Purge all {items.length} items?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setPurgeConfirmOpen(false);
                  handleDelete(items.map((i) => i.id));
                }}>
                Delete All
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
