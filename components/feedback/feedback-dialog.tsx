"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { submitFeedback, type FeedbackTag } from "@/lib/supabase/feedback";

interface FeedbackDialogProps {
  open: boolean;
  onClose: () => void;
}

const TAGS: { value: FeedbackTag; label: string }[] = [
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Feature" },
  { value: "question", label: "Question" },
  { value: "other", label: "Other" },
];

/**
 * Modal dialog for submitting alpha feedback. Captures the current URL and
 * user agent automatically. Submission requires text; tag is optional.
 */
export function FeedbackDialog({ open, onClose }: FeedbackDialogProps) {
  const [text, setText] = useState("");
  const [tag, setTag] = useState<FeedbackTag | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Reset state when dialog re-opens.
  useEffect(() => {
    if (open) {
      setText("");
      setTag(null);
      setError(null);
      setSuccess(false);
      setSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("You must be signed in to submit feedback.");
      setSubmitting(false);
      return;
    }

    const errMsg = await submitFeedback(supabase, user.id, {
      text,
      tag,
      pageUrl: typeof window !== "undefined" ? window.location.pathname + window.location.search : null,
      userAgent: typeof window !== "undefined" ? window.navigator.userAgent : null,
    });

    if (errMsg) {
      setError(errMsg);
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    setSubmitting(false);
    // Brief success confirmation, then close.
    setTimeout(() => onClose(), 1200);
  };

  const submitDisabled = submitting || success || text.trim().length === 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send Feedback</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tag chips */}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Type (optional)</p>
            <div className="flex flex-wrap gap-1.5">
              {TAGS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTag(tag === t.value ? null : t.value)}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-full border transition-colors",
                    tag === t.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border hover:border-muted-foreground",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Text area */}
          <div>
            <label htmlFor="feedback-text" className="text-xs text-muted-foreground mb-1.5 block">
              What&apos;s on your mind?
            </label>
            <textarea
              id="feedback-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={submitting || success}
              placeholder="Describe the bug, idea, or question..."
              autoFocus
              rows={5}
              className={cn(
                "w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                "placeholder:text-muted-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-60",
                "resize-none",
              )}
            />
          </div>

          {/* Error / success */}
          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="text-xs text-primary" role="status">
              Thanks — feedback sent.
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitDisabled}>
              {submitting ? "Sending..." : success ? "Sent" : "Send"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
