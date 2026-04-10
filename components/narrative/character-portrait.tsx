"use client";

import { useRef, useState, useCallback } from "react";
import { Upload, Download, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface CharacterPortraitProps {
  characterId: string;
  characterName: string;
  portraitUrl?: string | null;
  tokenUrl?: string | null;
  editable: boolean;
  onPortraitChange: (url: string | null) => void;
  onTokenChange: (url: string | null) => void;
  uploadAction: (formData: FormData) => Promise<{ success?: boolean; url?: string; error?: string }>;
  deleteAction: (characterId: string, type: "portrait" | "token") => Promise<{ success?: boolean; error?: string }>;
}

type TabType = "portrait" | "token";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.charAt(0).toUpperCase();
}

export function CharacterPortrait({
  characterId,
  characterName,
  portraitUrl,
  tokenUrl,
  editable,
  onPortraitChange,
  onTokenChange,
  uploadAction,
  deleteAction,
}: CharacterPortraitProps) {
  const [activeTab, setActiveTab] = useState<TabType>("portrait");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentUrl = activeTab === "portrait" ? portraitUrl : tokenUrl;
  const onCurrentChange =
    activeTab === "portrait" ? onPortraitChange : onTokenChange;

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploading(true);
      try {
        const formData = new FormData();
        formData.set("characterId", characterId);
        formData.set("file", file);
        formData.set("type", activeTab);

        const result = await uploadAction(formData);
        if (result.url) {
          onCurrentChange(result.url);
        }
      } finally {
        setUploading(false);
        // Reset file input so re-uploading the same file works
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [characterId, activeTab, uploadAction, onCurrentChange],
  );

  const handleDelete = useCallback(async () => {
    setUploading(true);
    try {
      const result = await deleteAction(characterId, activeTab);
      if (!result.error) {
        onCurrentChange(null);
      }
    } finally {
      setUploading(false);
    }
  }, [characterId, activeTab, deleteAction, onCurrentChange]);

  const handleDownload = useCallback(() => {
    if (!currentUrl) return;
    const a = document.createElement("a");
    a.href = currentUrl;
    a.download = `${characterName.replace(/\s+/g, "-").toLowerCase()}-${activeTab}`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [currentUrl, characterName, activeTab]);

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Tab switcher */}
      <div className="flex gap-1 rounded-lg bg-muted p-0.5">
        <button
          type="button"
          onClick={() => setActiveTab("portrait")}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-colors",
            activeTab === "portrait"
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Portrait
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("token")}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-colors",
            activeTab === "token"
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Token
        </button>
      </div>

      {/* Image container */}
      <div className="relative group">
        <div
          className={cn(
            "size-40 rounded-lg border border-border bg-card overflow-hidden flex items-center justify-center",
            editable && !uploading && "cursor-pointer",
          )}
          onClick={() => {
            if (editable && !uploading) {
              fileInputRef.current?.click();
            }
          }}
          role={editable ? "button" : undefined}
          tabIndex={editable ? 0 : undefined}
          onKeyDown={(e) => {
            if (editable && (e.key === "Enter" || e.key === " ")) {
              fileInputRef.current?.click();
            }
          }}
          aria-label={
            editable
              ? `Upload ${activeTab} image`
              : `${activeTab} image`
          }
        >
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-card/80 z-10">
              <Loader2 className="size-6 text-muted-foreground animate-spin" />
            </div>
          )}

          {currentUrl ? (
            <img
              src={currentUrl}
              alt={`${characterName} ${activeTab}`}
              className="size-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-1">
              <span className="text-3xl font-bold text-muted-foreground select-none">
                {getInitials(characterName)}
              </span>
              {editable && (
                <Upload className="size-4 text-muted-foreground opacity-60" />
              )}
            </div>
          )}
        </div>

        {/* Action buttons overlay */}
        {currentUrl && (
          <div className="absolute bottom-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="bg-card/80 backdrop-blur-sm text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload();
              }}
              aria-label={`Download ${activeTab}`}
            >
              <Download className="size-3.5" />
            </Button>

            {editable && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="bg-card/80 backdrop-blur-sm text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                aria-label={`Delete ${activeTab}`}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
}
