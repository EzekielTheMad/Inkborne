"use client";

import { useState } from "react";
import { Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RestDialog } from "@/components/sheet/rest-dialog";

/**
 * Stat-ribbon trigger for the rest dialog. Keeps dialog open/close state local
 * so the dialog mounts only when the button is clicked.
 */
export function RestButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="shrink-0"
      >
        <Moon className="size-4 mr-1.5" />
        Rest
      </Button>
      <RestDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
