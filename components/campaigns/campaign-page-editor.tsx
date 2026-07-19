"use client";

import { useActionState, useState } from "react";
import type { JSONContent } from "@tiptap/react";
import {
  updateCampaignPage,
  type UpdateCampaignPageState,
} from "@/app/(app)/campaigns/actions";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CampaignPageEditorProps {
  campaignId: string;
  pageId: string;
  title: string;
  content: JSONContent;
  visibility: "campaign" | "dm_only";
  revision: number;
}

export function CampaignPageEditor({
  campaignId,
  pageId,
  title,
  content: initialContent,
  visibility,
  revision,
}: CampaignPageEditorProps) {
  const [content, setContent] = useState<JSONContent>(initialContent);
  const initialState: UpdateCampaignPageState = {
    status: "idle",
    message: "",
    revision,
  };
  const [state, formAction, pending] = useActionState(
    updateCampaignPage,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="campaign_id" value={campaignId} />
      <input type="hidden" name="page_id" value={pageId} />
      <input type="hidden" name="revision" value={state.revision} />
      <input type="hidden" name="content" value={JSON.stringify(content)} />

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-2">
          <Label htmlFor="campaign-page-title">Title</Label>
          <Input
            id="campaign-page-title"
            name="title"
            defaultValue={title}
            maxLength={200}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="campaign-page-visibility">Visibility</Label>
          <select
            id="campaign-page-visibility"
            name="visibility"
            defaultValue={visibility}
            className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="campaign">Everyone in campaign</option>
            <option value="dm_only">Only author and DM</option>
          </select>
        </div>
      </div>

      <RichTextEditor
        content={content}
        onChange={setContent}
        campaignId={campaignId}
        minHeight="360px"
        placeholder="Build this corner of the world..."
      />

      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite" className="text-sm">
          {state.status === "success" && (
            <span className="text-accent">{state.message}</span>
          )}
          {state.status === "error" && (
            <span className="text-destructive">{state.message}</span>
          )}
          {state.status === "conflict" && (
            <span className="text-destructive">{state.message}</span>
          )}
        </div>
        <div className="flex gap-2 self-end">
          {state.status === "conflict" && (
            <Button type="button" variant="outline" onClick={() => window.location.reload()}>
              Reload latest
            </Button>
          )}
          <Button type="submit" variant="gold" disabled={pending || state.status === "conflict"}>
            {pending ? "Saving..." : "Save page"}
          </Button>
        </div>
      </div>
    </form>
  );
}
