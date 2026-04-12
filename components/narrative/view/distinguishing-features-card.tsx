"use client";

import type { JSONContent } from "@tiptap/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RichTextRenderer } from "@/components/editor/rich-text-renderer";

interface DistinguishingFeaturesCardProps {
  content: JSONContent | null | undefined;
}

export function DistinguishingFeaturesCard({
  content,
}: DistinguishingFeaturesCardProps) {
  if (!content || (content.type === "doc" && !content.content?.length)) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-accent">Distinguishing Features</CardTitle>
      </CardHeader>
      <CardContent>
        <RichTextRenderer content={content} />
      </CardContent>
    </Card>
  );
}
