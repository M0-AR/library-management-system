"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button, useToast } from "@/components/ui";
import { ApiError, downloadFile } from "@/lib/api";

export function ExportButton({
  resource,
  label = "Export CSV",
}: {
  resource: "loans" | "members" | "fines";
  label?: string;
}) {
  const { push } = useToast();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      await downloadFile(`/exports/${resource}`, { scope: "staff" });
      push({
        title: "Export ready",
        description: "The CSV file is in your downloads.",
        tone: "success",
      });
    } catch (err) {
      push({
        title: "Export failed",
        description: err instanceof ApiError ? err.message : "Please try again.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" onClick={run} loading={busy} icon={<Download className="h-4 w-4" />}>
      {label}
    </Button>
  );
}
