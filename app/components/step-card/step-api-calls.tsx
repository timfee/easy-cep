"use client";

import { StepIdValue } from "@/types";
import { useState } from "react";
import { stepApiMetadata } from "./step-api-metadata";

interface StepApiCallsProps {
  stepId: StepIdValue;
}

export function StepApiCalls({ stepId }: StepApiCallsProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const calls = stepApiMetadata[stepId] || [];

  if (calls.length === 0) return null;

  const getFullUrl = (endpoint: string) => {
    if (endpoint.startsWith("/cloudidentity")) {
      return `https://cloudidentity.googleapis.com/v1${endpoint.slice("/cloudidentity".length)}`;
    }
    if (endpoint.startsWith("/graph/beta")) {
      return `https://graph.microsoft.com${endpoint.slice("/graph".length)}`;
    }
    if (endpoint.startsWith("/graph/v1.0")) {
      return `https://graph.microsoft.com${endpoint.slice("/graph".length)}`;
    }
    if (endpoint.startsWith("/graph")) {
      return `https://graph.microsoft.com${endpoint.slice("/graph".length)}`;
    }
    return `https://admin.googleapis.com/admin/directory/v1${endpoint}`;
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case "GET":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
      case "POST":
        return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
      case "PUT":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300";
      case "PATCH":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300";
      case "DELETE":
        return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  return (
    <div className="mt-4 rounded-lg bg-gray-50 p-3">
      <h4 className="mb-2 text-xs font-medium text-gray-800">API Calls</h4>
      <div className="space-y-1.5">
        {calls.map((call, index) => (
          <div
            key={index}
            className="relative group cursor-pointer hover:bg-gray-100 rounded-md p-1"
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}>
            <div className="flex items-start gap-3 text-xs">
              <span
                className={`font-mono font-medium px-2 py-0.5 rounded text-xs ${getMethodColor(call.method)}`}>
                {call.method}
              </span>
              <div className="flex-1">
                <p className="font-mono text-xs text-gray-700 break-all">
                  {call.endpoint}
                </p>
                <p className="mt-1 text-xs text-gray-500">{call.description}</p>
              </div>
            </div>

            {hoveredIndex === index && (
              <div className="absolute z-10 left-0 mt-2 p-3 bg-gray-900/90 text-white rounded-lg shadow-lg text-xs max-w-xl">
                <p className="font-mono mb-2 break-all">
                  {getFullUrl(call.endpoint)}
                </p>
                {call.body && (
                  <>
                    <p className="mb-1 text-gray-300">Request body:</p>
                    <pre className="text-xs overflow-x-auto bg-gray-800 dark:bg-gray-600 p-2 rounded">
                      {JSON.stringify(call.body, null, 2)}
                    </pre>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
