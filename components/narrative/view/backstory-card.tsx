"use client";

import type { JSONContent } from "@tiptap/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RichTextRenderer } from "@/components/editor/rich-text-renderer";

interface BackstoryCardProps {
  title: string;
  content: JSONContent | null | undefined;
}

export function BackstoryCard({ title, content }: BackstoryCardProps) {
  if (!content || (content.type === "doc" && !content.content?.length)) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-accent">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <RichTextRenderer content={content} />
      </CardContent>
    </Card>
  );
}
