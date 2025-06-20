import { PROTECTED_RESOURCES } from "@/constants";
import { env } from "@/env";
import type { Metadata } from "next";
import "./globals.css";

// Initialize protected resources
if (env.MICROSOFT_OAUTH_CLIENT_ID) {
  PROTECTED_RESOURCES.microsoftAppIds.add(env.MICROSOFT_OAUTH_CLIENT_ID);
}

export const metadata: Metadata = { title: "Easy CEP" };

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
