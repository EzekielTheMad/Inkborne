import Link from "next/link";
import { ArrowLeft, Braces, LockKeyhole } from "lucide-react";
import { redirect } from "next/navigation";

import { MpmbImportUploadForm } from "@/components/library/mpmb-import-upload-form";
import { createClient } from "@/lib/supabase/server";

export default async function MpmbImportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto w-full max-w-3xl space-y-7">
      <Link href="/library" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Back to library
      </Link>

      <div>
        <p className="j-folio">Bring your own rules</p>
        <h1 className="j-display mt-1.5 text-3xl text-foreground sm:text-4xl">
          Import MPMB content
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Inkborne reads the static spell and feat data in an MPMB community
          file, then lets you review every mapped field before anything reaches
          your private library.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border/80 bg-muted/20 p-4">
          <Braces className="size-5 text-accent" />
          <h2 className="mt-2 text-sm font-medium text-foreground">Static data only</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Functions, evaluators, and side effects are rejected rather than run.
          </p>
        </div>
        <div className="rounded-lg border border-border/80 bg-muted/20 p-4">
          <LockKeyhole className="size-5 text-accent" />
          <h2 className="mt-2 text-sm font-medium text-foreground">Private by construction</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Imported content starts personal and the database blocks campaign sharing.
          </p>
        </div>
      </div>

      <MpmbImportUploadForm />
    </div>
  );
}
