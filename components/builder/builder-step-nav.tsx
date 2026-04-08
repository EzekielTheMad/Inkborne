"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { CreationStep } from "@/lib/types/system";

interface StepStatus {
  [stepType: string]: "complete" | "in_progress" | "untouched";
}

interface BuilderStepNavProps {
  characterId: string;
  steps: CreationStep[];
  stepStatus: StepStatus;
}

export function BuilderStepNav({
  characterId,
  steps,
  stepStatus,
}: BuilderStepNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 border-b pb-3 mb-6">
      <Link
        href={`/characters/${characterId}/builder`}
        className={cn(
          "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
          pathname === `/characters/${characterId}/builder`
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        )}
      >
        Overview
      </Link>
      {steps.map((step) => {
        const status = stepStatus[step.type] ?? "untouched";
        const isActive = pathname.endsWith(`/builder/${step.type}`);

        return (
          <Link
            key={step.type}
            href={`/characters/${characterId}/builder/${step.type}`}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <span
              className={cn(
                "inline-block w-2 h-2 rounded-full",
                status === "complete" && "bg-green-500",
                status === "in_progress" && "bg-blue-500",
                status === "untouched" && "bg-muted-foreground/30",
              )}
            />
            {step.label}
          </Link>
        );
      })}
    </nav>
  );
}
