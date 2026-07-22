"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

import { FeedbackDialog } from "@/components/feedback/feedback-dialog";

type OpenFeedback = () => void;

const FeedbackContext = createContext<OpenFeedback | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openFeedback = useCallback(() => setOpen(true), []);

  return (
    <FeedbackContext value={openFeedback}>
      {children}
      <FeedbackDialog open={open} onClose={() => setOpen(false)} />
    </FeedbackContext>
  );
}

export function useFeedbackTrigger() {
  return useContext(FeedbackContext);
}
