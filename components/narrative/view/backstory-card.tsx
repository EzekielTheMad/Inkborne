"use client";

import type { JSONContent } from "@tiptap/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RichTextRenderer } from "@/components/editor/rich-text-renderer";
import { LockIcon } from "lucide-react";

interface BackstoryCardProps {
  title: string;
  content: JSONContent | null | undefined;
  dmOnly?: boolean;
}

export function BackstoryCard({ title, content, dmOnly }: BackstoryCardProps) {
  if (!content || (content.type === "doc" && !content.content?.length)) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-accent">{title}</CardTitle>
          {dmOnly && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <LockIcon className="size-3" />
              Only visible to you and the DM
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <RichTextRenderer content={content} />
      </CardContent>
    </Card>
  );
}
