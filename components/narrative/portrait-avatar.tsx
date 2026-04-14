"use client";

import { cn } from "@/lib/utils";

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PortraitAvatarProps {
  portraitUrl?: string | null;
  characterName: string;
  size: "sm" | "md" | "lg";
  className?: string;
  cropArea?: CropArea | null;
}

const sizeMap = {
  sm: "size-12", // 48px — header
  md: "size-14", // 56px — card
  lg: "size-16", // 64px — dashboard overview
} as const;

const textSizeMap = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl",
} as const;

function getInitials(name: string): string {
  if (!name) return "?";
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
  cropArea,
}: PortraitAvatarProps) {
  // Build crop styles: scale the image so only the cropped region fills the container
  const cropStyle = cropArea
    ? {
        objectFit: "none" as const,
        objectPosition: `${-cropArea.x}px ${-cropArea.y}px`,
        width: `${cropArea.width}px`,
        height: `${cropArea.height}px`,
        transform: `scale(${100 / cropArea.width})`,
        transformOrigin: "top left",
      }
    : undefined;

  return (
    <div
      className={cn(
        "shrink-0 rounded-full overflow-hidden border border-border bg-muted flex items-center justify-center",
        sizeMap[size],
        className,
      )}
    >
      {portraitUrl ? (
        cropStyle ? (
          <div className="size-full overflow-hidden">
            <img
              src={portraitUrl}
              alt={characterName}
              style={cropStyle}
            />
          </div>
        ) : (
          <img
            src={portraitUrl}
            alt={characterName}
            className="size-full object-cover"
          />
        )
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
