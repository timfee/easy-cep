"use client";

import { useEffect, useState } from "react";
import { ApiEndpoint } from "../constants";
import { Badge } from "./ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "./ui/tooltip";

type StepIdValue = string;

interface ApiCallTemplate {
  id: string;
  method: string;
  url: string;
  description: string;
  requestBody?: Record<string, unknown>;
}

interface StepApiCallsProps {
  stepId: StepIdValue;
}

export function StepApiCalls({ stepId }: StepApiCallsProps) {
  const [apiTemplates, setApiTemplates] = useState<ApiCallTemplate[]>([]);

  useEffect(() => {
    const templates: Record<string, ApiCallTemplate[]> = {
      "fetch-calendar": [
        {
          id: "1",
          method: "GET",
          url: `${ApiEndpoint.Google.Users}/calendar/events`,
          description: "Fetch upcoming calendar events from primary calendar"
        }
      ],
      "sync-contacts": [
        {
          id: "2",
          method: "GET",
          url: `${ApiEndpoint.Microsoft.Me}/contacts`,
          description: "Retrieve user contacts from Microsoft Graph"
        },
        {
          id: "3",
          method: "POST",
          url: `${ApiEndpoint.Microsoft.Me}/contacts`,
          description: "Create new contact in Microsoft Graph",
          requestBody: {
            displayName: "John Doe",
            emailAddresses: [{ address: "john@example.com", name: "John Doe" }],
            businessPhones: ["+1 555 0123"]
          }
        }
      ]
    };
    setApiTemplates(templates[stepId] || []);
  }, [stepId]);

  const getMethodBadge = (method: string) => {
    const colors = {
      GET: "bg-blue-100 text-blue-800 border-blue-200",
      POST: "bg-green-100 text-green-800 border-green-200",
      PUT: "bg-amber-100 text-amber-800 border-amber-200",
      DELETE: "bg-red-100 text-red-800 border-red-200"
    };
    return (
      <Badge
        variant="outline"
        className={
          colors[method as keyof typeof colors]
          || "bg-slate-100 text-slate-800 border-slate-200"
        }>
        {method}
      </Badge>
    );
  };

  if (apiTemplates.length === 0) {
    return (
      <div className="text-center py-4 text-slate-500">
        <p className="text-sm">No API operations defined for this step</p>
      </div>
    );
  }

  return (
    // Removed ScrollArea and outer border, each item is self-contained
    <div className="space-y-3">
      {apiTemplates.map((template) => (
        <TooltipProvider key={template.id}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/30 hover:bg-slate-100/50 transition-colors duration-150 cursor-help">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    {getMethodBadge(template.method)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 mb-1">
                      {template.description}
                    </p>
                    <code className="text-xs text-slate-600 bg-white px-2 py-1 rounded border border-slate-300 break-all">
                      {template.url}
                    </code>
                  </div>
                </div>
              </div>
            </TooltipTrigger>
            {template.requestBody && (
              <TooltipContent side="bottom" className="max-w-md">
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Request Body:</p>
                  <pre className="text-xs bg-slate-800 text-slate-100 p-2 rounded overflow-auto max-h-40">
                    {JSON.stringify(template.requestBody, null, 2)}
                  </pre>
                </div>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  );
}
