"use client";

import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeedbackDialog } from "@/components/feedback/feedback-dialog";
import { useFeedbackTrigger } from "@/components/feedback/feedback-provider";

interface FeedbackButtonProps {
  /** If true, render only the icon (no label) — useful for compact nav rows. */
  iconOnly?: boolean;
}

/**
 * Feedback trigger button. Opens a modal dialog with a short form for
 * submitting alpha feedback. Keeps dialog state local so it only mounts
 * when the user clicks.
 */
export function FeedbackButton({ iconOnly = false }: FeedbackButtonProps) {
  const openGlobalFeedback = useFeedbackTrigger();
  const [localOpen, setLocalOpen] = useState(false);

  function openFeedback() {
    if (openGlobalFeedback) {
      openGlobalFeedback();
      return;
    }

    setLocalOpen(true);
  }

  return (
    <>
      <Button
        variant="ghost"
        size={iconOnly ? "icon" : "sm"}
        onClick={openFeedback}
        aria-label="Send feedback"
        title="Send feedback"
        className="shrink-0"
      >
        <MessageSquare className="size-4" />
        {!iconOnly && <span className="ml-1.5">Feedback</span>}
      </Button>
      {!openGlobalFeedback && (
        <FeedbackDialog
          open={localOpen}
          onClose={() => setLocalOpen(false)}
        />
      )}
    </>
  );
}
