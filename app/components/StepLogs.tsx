"use client";
import { LogLevel, StepLogEntry } from "@/types";
import { Disclosure } from "@headlessui/react";
import { ChevronDownIcon as ChevronDown } from "@heroicons/react/24/outline";
import { AnimatePresence, motion } from "framer-motion";
import { Badge } from "./ui/badge";

interface StepLogsProps {
  logs: StepLogEntry[] | undefined;
}

export default function StepLogs({ logs }: StepLogsProps) {
  if (!logs || logs.length === 0) return null;

  const levelColor: Record<
    LogLevel,
    | "zinc"
    | "indigo"
    | "cyan"
    | "red"
    | "orange"
    | "amber"
    | "yellow"
    | "lime"
    | "green"
    | "emerald"
    | "teal"
    | "sky"
    | "blue"
    | "violet"
    | "purple"
    | "fuchsia"
    | "pink"
    | "rose"
    | undefined
  > = {
    [LogLevel.Info]: "blue",
    [LogLevel.Warn]: "amber",
    [LogLevel.Error]: "red",
    [LogLevel.Debug]: "zinc"
  };

  const INDENT = 2;

  return (
    <Disclosure>
      {({ open }) => (
        <div className="mt-4">
          <Disclosure.Button className="flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline">
            <ChevronDown
              className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
            />
            View logs ({logs.length})
          </Disclosure.Button>
          <AnimatePresence initial={false}>
            {open && (
              <Disclosure.Panel static>
                <motion.ul
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-2 max-h-96 space-y-2 overflow-auto">
                  {logs.map((l, idx) => (
                    <li
                      key={idx}
                      className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs">
                      <details className="group open:pb-2">
                        <summary className="flex cursor-pointer items-center justify-between gap-2">
                          <span className="flex items-center gap-2">
                            <span className="text-gray-500">
                              {new Date(l.timestamp).toLocaleTimeString()}
                            </span>
                            {l.level && (
                              <Badge
                                className="px-1.5 py-0.5 text-xs"
                                color={levelColor[l.level]}>
                                {l.level}
                              </Badge>
                            )}
                          </span>
                          <span className="flex-1 truncate text-left">
                            {l.message}
                          </span>
                        </summary>
                        {l.data !== undefined && l.data !== null && (
                          <pre className="mt-2 whitespace-pre-wrap rounded bg-white p-2 dark:bg-zinc-800">
                            {JSON.stringify(l.data, null, INDENT)}
                          </pre>
                        )}
                      </details>
                    </li>
                  ))}
                </motion.ul>
              </Disclosure.Panel>
            )}
          </AnimatePresence>
        </div>
      )}
    </Disclosure>
  );
}
