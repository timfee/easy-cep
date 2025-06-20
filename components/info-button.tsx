"use client";

import { Button } from "@/components/ui/button";
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
}

interface InfoButtonProps {
  title: string;
  fetchItems: () => Promise<InfoItem[]>;
}

export function InfoButton({ title, fetchItems }: InfoButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<InfoItem[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoading(true);
      setError(undefined);
      try {
        const res = await fetchItems();
        setItems(res);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [open, fetchItems]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="border-slate-300 text-slate-700">
          <Info className="h-3.5 w-3.5 mr-1.5" /> Info
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {loading && <p className="text-sm text-slate-600">Loading...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && !error && (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id} className="text-sm">
                {item.href ?
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline">
                    {item.label}
                  </a>
                : <span>{item.label}</span>}
              </li>
            ))}
            {items.length === 0 && (
              <li className="text-slate-600">No entries found.</li>
            )}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
