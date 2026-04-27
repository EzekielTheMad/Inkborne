import { cn } from "@/lib/utils";
import { classTone, classEmblemLetter, type ClassTone } from "@/lib/builder/class-tone";

interface ClassEmblemProps {
  slug: string;
  name?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<ClassEmblemProps["size"]>, string> = {
  sm: "size-6 text-[13px]",
  md: "size-8 text-[16px]",
  lg: "size-14 text-[32px]",
};

const TONE_CLASSES: Record<ClassTone, string> = {
  gold: "bg-[rgba(201,164,74,0.18)] border-[rgba(201,164,74,0.5)] text-[#c9a44a]",
  purple: "bg-[rgba(124,58,237,0.2)] border-[rgba(124,58,237,0.55)] text-[#c7b0ff]",
};

export function ClassEmblem({ slug, name, size = "md", className }: ClassEmblemProps) {
  const tone = classTone(slug);
  const letter = classEmblemLetter(slug, name);

  return (
    <div
      data-slot="class-emblem"
      data-tone={tone}
      aria-hidden="true"
      className={cn(
        "inline-flex items-center justify-center rounded-md border font-bold leading-none",
        "font-[Georgia,serif]",
        SIZE_CLASSES[size],
        TONE_CLASSES[tone],
        className,
      )}
    >
      <span>{letter}</span>
    </div>
  );
}
