"use client";

/* eslint-disable @next/next/no-img-element -- User-uploaded portraits use arbitrary storage URLs. */

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface CropArea {
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
  sm: "size-12",
  md: "size-14",
  lg: "size-16",
} as const;

const sizePx = { sm: 48, md: 56, lg: 64 } as const;

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
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);

  // Calculate styles for cropped view using the original image dimensions
  const getCroppedImgStyle = (): React.CSSProperties | undefined => {
    if (!cropArea || !naturalSize) return undefined;
    const container = sizePx[size];
    const scale = container / cropArea.width;
    return {
      position: "absolute",
      width: naturalSize.w * scale,
      height: naturalSize.h * scale,
      left: -cropArea.x * scale,
      top: -cropArea.y * scale,
      maxWidth: "none",
    };
  };

  return (
    <div
      className={cn(
        "shrink-0 rounded-full overflow-hidden border border-border bg-muted flex items-center justify-center relative",
        sizeMap[size],
        className,
      )}
    >
      {portraitUrl ? (
        cropArea ? (
          <>
            {/* Hidden image to get natural dimensions */}
            <img
              src={portraitUrl}
              alt=""
              className="hidden"
              onLoad={(e) => {
                const img = e.currentTarget;
                setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
              }}
            />
            {/* Cropped visible image */}
            {naturalSize && (
              <img
                src={portraitUrl}
                alt={characterName}
                style={getCroppedImgStyle()}
              />
            )}
          </>
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
