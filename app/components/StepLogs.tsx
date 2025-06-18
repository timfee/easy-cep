"use client";
import { LogLevel, StepLogEntry } from "@/types";
import { Disclosure, Transition } from "@headlessui/react";
import { ChevronDown } from "lucide-react";

interface StepLogsProps {
  logs: StepLogEntry[] | undefined;
}

export default function StepLogs({ logs }: StepLogsProps) {
  if (!logs || logs.length === 0) return null;

  const levelColor: Record<LogLevel, string> = {
    [LogLevel.Info]: "border-blue-500",
    [LogLevel.Warn]: "border-amber-500",
    [LogLevel.Error]: "border-red-500",
    [LogLevel.Debug]: "border-gray-400"
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
          <Transition
            show={open}
            enter="transition duration-200 ease-out"
            enterFrom="transform opacity-0 -translate-y-2"
            enterTo="transform opacity-100 translate-y-0"
            leave="transition duration-150 ease-in"
            leaveFrom="transform opacity-100 translate-y-0"
            leaveTo="transform opacity-0 -translate-y-2">
            <Disclosure.Panel
              static
              className="mt-2 max-h-48 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs font-mono">
              <ul className="space-y-1">
                {logs.map((l, idx) => (
                  <li
                    key={idx}
                    className={`border-l-4 pl-2 ${levelColor[l.level ?? LogLevel.Info]}`}>
                    <span className="text-gray-500 mr-2">
                      {new Date(l.timestamp).toLocaleTimeString()}
                    </span>
                    {l.message}
                  </li>
                ))}
              </ul>
            </Disclosure.Panel>
          </Transition>
        </div>
      )}
    </Disclosure>
  );
}
