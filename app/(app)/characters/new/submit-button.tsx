"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function CharacterSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <>
      <Button type="submit" variant="gold" className="w-full" disabled={disabled || pending}>
        {pending ? "Creating character…" : "Begin →"}
      </Button>
      {pending && <p role="status" className="text-sm text-muted-foreground">Creating your character. Please wait.</p>}
    </>
  );
}
