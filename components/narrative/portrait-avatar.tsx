"use client";

import { cn } from "@/lib/utils";

interface PortraitAvatarProps {
  portraitUrl?: string | null;
  characterName: string;
  size: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "size-10", // 40px — header
  md: "size-12", // 48px — card
  lg: "size-16", // 64px — dashboard overview
} as const;

const textSizeMap = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl",
} as const;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.charAt(0).toUpperCase();
}

export function PortraitAvatar({
  portraitUrl,
  characterName,
  size,
  className,
}: PortraitAvatarProps) {
  return (
    <div
      className={cn(
        "shrink-0 rounded-full overflow-hidden border border-border bg-muted flex items-center justify-center",
        sizeMap[size],
        className,
      )}
    >
      {portraitUrl ? (
        <img
          src={portraitUrl}
          alt={characterName}
          className="size-full object-cover"
        />
      ) : (
        <span
          className={cn(
            "font-bold text-muted-foreground select-none",
            textSizeMap[size],
          )}
        >
          {getInitials(characterName)}
        </span>
      )}
    </div>
  );
}
