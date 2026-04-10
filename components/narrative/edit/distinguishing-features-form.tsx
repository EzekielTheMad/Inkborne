"use client";

import type { JSONContent } from "@tiptap/react";
import { RichTextEditor } from "@/components/editor/rich-text-editor";

interface DistinguishingFeaturesFormProps {
  content: JSONContent | null;
  campaignId?: string | null;
  onChange: (content: JSONContent) => void;
}

export function DistinguishingFeaturesForm({
  content,
  campaignId,
  onChange,
}: DistinguishingFeaturesFormProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-accent">
        Distinguishing Features
      </h3>
      <RichTextEditor
        content={content}
        onChange={onChange}
        placeholder="Scars, tattoos, unusual physical traits..."
        minHeight="100px"
        campaignId={campaignId ?? undefined}
      />
    </div>
  );
}
