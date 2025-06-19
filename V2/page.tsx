"use client";
import { WorkflowClient } from "@/components/workflow-client";

// Sample workflow steps for demonstration
// ADDING DESCRIPTIONS HERE
const sampleSteps = [
  {
    id: "auth-google" as const,
    name: "Authenticate Google",
    description:
      "Connects to Google services using OAuth to gain access to calendar and contact information. This step is crucial for fetching user data.",
    requires: [] as const,
    provides: ["googleAccessToken", "userEmail"] as const
  },
  {
    id: "fetch-calendar" as const,
    name: "Fetch Calendar Events",
    description:
      "Retrieves upcoming events from the user's primary Google Calendar for the next 7 days.",
    requires: ["googleAccessToken"] as const,
    provides: ["calendarEvents"] as const
  },
  {
    id: "auth-msgraph" as const,
    name: "Authenticate Microsoft Graph",
    description:
      "Establishes a connection with Microsoft Graph API to enable contact synchronization.",
    requires: [] as const,
    provides: ["msGraphToken"] as const
  },
  {
    id: "sync-contacts" as const,
    name: "Synchronize Contacts",
    description:
      "Syncs contacts between Google and Microsoft services based on the authenticated user's email.",
    requires: ["msGraphToken", "userEmail"] as const,
    provides: ["contactsSynced"] as const
  },
  {
    id: "generate-report" as const,
    name: "Generate Summary Report",
    description:
      "Compiles a report based on the fetched calendar events and contact synchronization status.",
    requires: ["calendarEvents", "contactsSynced"] as const,
    provides: ["reportGenerated"] as const
  }
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <WorkflowClient steps={sampleSteps} />
    </div>
  );
}
