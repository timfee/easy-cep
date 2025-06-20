"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CompletionCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Setup Complete</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-slate-700">
        <p>All steps have finished successfully.</p>
        <p>
          Open a new browser window and sign in with a test account to verify
          single sign-on works as expected.
        </p>
        <Button
          size="sm"
          onClick={() => window.open("https://accounts.google.com/", "_blank")}>
          Open Google sign-in
        </Button>
      </CardContent>
    </Card>
  );
}
