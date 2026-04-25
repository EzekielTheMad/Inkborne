"use client";

import { useState, useTransition } from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeedbackDialog } from "@/components/feedback/feedback-dialog";
import { dismissAlphaBanner } from "@/app/(app)/dashboard/actions";

export function AlphaBanner() {
  const [hidden, setHidden] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [, startTransition] = useTransition();

  if (hidden) return null;

  function handleDismiss() {
    setHidden(true);
    startTransition(() => {
      dismissAlphaBanner().catch((err) => {
        console.error("[AlphaBanner] dismiss failed:", err);
      });
    });
  }

  return (
    <>
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
        <Sparkles className="size-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            You&rsquo;re testing Inkborne Alpha
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            A character + campaign tool for tabletop RPGs. Things will change as we build. Hit a snag or have ideas? Send feedback.
          </p>
          <div className="mt-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setFeedbackOpen(true)}
            >
              Send Feedback
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss alpha banner"
          className="text-muted-foreground hover:text-foreground transition-colors p-1 -m-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" />
        </button>
      </div>
      <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}
