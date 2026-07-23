"use client";

import Link from "next/link";
import { FileCode2, ShieldCheck, Upload } from "lucide-react";
import { useActionState } from "react";

import {
  startMpmbImport,
  type MpmbImportActionState,
} from "@/app/(app)/homebrew/import/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const initialState: MpmbImportActionState = { status: "idle" };

export function MpmbImportUploadForm() {
  const [state, formAction, pending] = useActionState(startMpmbImport, initialState);

  return (
    <form action={formAction} className="j-card-paper space-y-6 p-5 sm:p-7">
      <div className="space-y-2">
        <Label htmlFor="mpmb-file">MPMB import file</Label>
        <label
          htmlFor="mpmb-file"
          className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-accent/40 bg-accent/5 px-5 py-8 text-center transition-colors hover:border-accent/70 hover:bg-accent/10"
        >
          <FileCode2 className="size-7 text-accent" />
          <span className="mt-3 text-sm font-medium text-foreground">
            Choose a .js or .mpmb file
          </span>
          <span className="mt-1 text-xs text-muted-foreground">
            Up to 2 MiB. The source is parsed in memory and never stored.
          </span>
          <input
            id="mpmb-file"
            name="file"
            type="file"
            accept=".js,.mpmb,text/javascript,application/javascript"
            className="sr-only"
            required
          />
        </label>
      </div>

      <label className="flex items-start gap-3 rounded-lg border border-border/80 bg-muted/30 p-4 text-sm">
        <input
          type="checkbox"
          name="private_use_attestation"
          className="mt-0.5 size-4 accent-[var(--accent)]"
          required
        />
        <span>
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <ShieldCheck className="size-4 text-accent" />
            Private-use attestation
          </span>
          <span className="mt-1 block leading-relaxed text-muted-foreground">
            I have the right to use this file. I understand imported definitions
            remain private and cannot be shared with campaigns in this release.
          </span>
        </span>
      </label>

      {state.status !== "idle" && state.status !== "success" && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <Link href="/homebrew" className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
        <Button type="submit" variant="gold" disabled={pending}>
          <Upload className="size-4" />
          {pending ? "Reading safely..." : "Review import"}
        </Button>
      </div>
    </form>
  );
}
