"use client";

import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";

interface ConfirmActionButtonProps extends ComponentProps<typeof Button> {
  confirmation: string;
}

export function ConfirmActionButton({
  confirmation,
  onClick,
  ...props
}: ConfirmActionButtonProps) {
  return (
    <Button
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented && !window.confirm(confirmation)) {
          event.preventDefault();
        }
      }}
    />
  );
}
