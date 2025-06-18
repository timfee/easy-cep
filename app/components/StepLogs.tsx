"use client";
import { LogLevel, StepLogEntry } from "@/types";
import { Disclosure } from "@headlessui/react";
import { ChevronDownIcon as ChevronDown } from "@heroicons/react/24/outline";
import { AnimatePresence, motion } from "framer-motion";
import { Badge } from "./ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "./ui/table";

interface StepLogsProps {
  logs: StepLogEntry[] | undefined;
}

export default function StepLogs({ logs }: StepLogsProps) {
  if (!logs || logs.length === 0) return null;

  const levelColor: Record<LogLevel, "blue" | "amber" | "red" | "zinc"> = {
    [LogLevel.Info]: "blue",
    [LogLevel.Warn]: "amber",
    [LogLevel.Error]: "red",
    [LogLevel.Debug]: "zinc"
  };

  return (
    <Disclosure>
      {({ open }) => (
        <div className="mt-4">
          <Disclosure.Button className="flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline">
            <ChevronDown
              className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
            />
            View logs
          </Disclosure.Button>
          <AnimatePresence initial={false}>
            {open && (
              <Disclosure.Panel static>
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-2 max-h-48 overflow-auto bg-black/30 rounded-lg overflow-hidden">
                  <Table bleed dense className="text-xs">
                    <TableHead>
                      <TableRow>
                        <TableHeader>Time</TableHeader>
                        <TableHeader>Level</TableHeader>
                        <TableHeader>Message</TableHeader>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {logs.map((l, idx) => (
                        <TableRow key={idx} className="even:bg-white/[0.02]">
                          <TableCell className="text-xs text-gray-500">
                            {new Date(l.timestamp).toLocaleTimeString()}
                          </TableCell>
                          <TableCell>
                            {l.level && (
                              <Badge
                                className="px-1.5 py-0.5 text-xs"
                                color={levelColor[l.level]}>
                                {l.level}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-pre-wrap">
                            {l.message}
                            {l.data !== undefined && l.data !== null && (
                              <pre className="mt-1 rounded bg-gray-100 p-1 dark:bg-zinc-800">
                                {JSON.stringify(l.data, null, INDENT)}
                              </pre>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </motion.div>
              </Disclosure.Panel>
            )}
          </AnimatePresence>
        </div>
      )}
    </Disclosure>
  );
}
