"use client";

import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExtension from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Mention from "@tiptap/extension-mention";
import { useCallback, useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { cn } from "@/lib/utils";
import { EditorToolbar } from "./editor-toolbar";
import { MentionList, type MentionListRef } from "./mention-list";
import type { MentionItem } from "@/lib/types/narrative";

interface RichTextEditorProps {
  content: JSONContent | null;
  onChange?: (content: JSONContent) => void;
  placeholder?: string;
  minHeight?: string;
  campaignId?: string;
  editable?: boolean;
}

function createMentionSuggestion(campaignId?: string) {
  return {
    items: async ({ query }: { query: string }): Promise<MentionItem[]> => {
      if (!campaignId || query.length < 1) return [];
      try {
        const res = await fetch(
          `/api/characters/search?q=${encodeURIComponent(query)}&campaignId=${encodeURIComponent(campaignId)}`,
        );
        if (!res.ok) return [];
        return (await res.json()) as MentionItem[];
      } catch {
        return [];
      }
    },

    render: () => {
      let component: HTMLDivElement | null = null;
      let reactRoot: Root | null = null;
      let listRef: MentionListRef | null = null;

      return {
        onStart: (props: {
          items: MentionItem[];
          command: (item: MentionItem) => void;
          clientRect?: (() => DOMRect | null) | null;
        }) => {
          component = document.createElement("div");
          component.style.position = "absolute";
          component.style.zIndex = "50";

          reactRoot = createRoot(component);
          reactRoot.render(
            <MentionList
              items={props.items}
              command={props.command}
              ref={(r) => {
                listRef = r;
              }}
            />,
          );

          const rect = props.clientRect?.();
          if (rect) {
            component.style.left = `${rect.left}px`;
            component.style.top = `${rect.bottom + 4}px`;
          }

          document.body.appendChild(component);
        },

        onUpdate: (props: {
          items: MentionItem[];
          command: (item: MentionItem) => void;
          clientRect?: (() => DOMRect | null) | null;
        }) => {
          if (reactRoot) {
            reactRoot.render(
              <MentionList
                items={props.items}
                command={props.command}
                ref={(r) => {
                  listRef = r;
                }}
              />,
            );
          }

          const rect = props.clientRect?.();
          if (rect && component) {
            component.style.left = `${rect.left}px`;
            component.style.top = `${rect.bottom + 4}px`;
          }
        },

        onKeyDown: (props: { event: KeyboardEvent }) => {
          if (props.event.key === "Escape") {
            if (component) {
              component.remove();
              component = null;
            }
            return true;
          }
          return listRef?.onKeyDown(props) ?? false;
        },

        onExit: () => {
          if (reactRoot) {
            reactRoot.unmount();
            reactRoot = null;
          }
          if (component) {
            component.remove();
            component = null;
          }
          listRef = null;
        },
      };
    },
  };
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = "Start writing...",
  minHeight = "120px",
  campaignId,
  editable = true,
}: RichTextEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    extensions: [
      StarterKit,
      LinkExtension.configure({
        openOnClick: !editable,
        autolink: true,
        HTMLAttributes: {
          class: "text-accent underline cursor-pointer",
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      Mention.configure({
        HTMLAttributes: {
          class: "mention",
        },
        suggestion: createMentionSuggestion(campaignId),
      }),
    ],
    immediatelyRender: false,
    content: content ?? undefined,
    editable,
    onUpdate: ({ editor: e }) => {
      onChangeRef.current?.(e.getJSON());
    },
    editorProps: {
      attributes: {
        class: cn(
          "tiptap prose-editor focus:outline-none",
          "text-foreground text-sm leading-relaxed",
        ),
        style: `min-height: ${minHeight}; padding: 0.75rem;`,
      },
    },
  });

  // Sync editable prop changes
  useEffect(() => {
    if (editor && editor.isEditable !== editable) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  // Sync content changes from parent
  const contentUpdated = useCallback(
    (newContent: JSONContent | null) => {
      if (!editor) return;
      const currentJSON = JSON.stringify(editor.getJSON());
      const newJSON = JSON.stringify(newContent ?? {});
      if (currentJSON !== newJSON && newContent) {
        editor.commands.setContent(newContent);
      }
    },
    [editor],
  );

  useEffect(() => {
    contentUpdated(content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  if (!editor) return null;

  return (
    <div
      className={cn(
        "rounded-md border border-input bg-card",
        editable && "focus-within:ring-2 focus-within:ring-ring",
      )}
    >
      {editable && <EditorToolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}
