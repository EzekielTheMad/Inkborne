"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { updatePreferences } from "@/app/(app)/settings/actions";

export function AppearanceSection() {
  const { theme, setTheme } = useTheme();

  async function handleThemeChange(newTheme: "dark" | "light" | "system") {
    setTheme(newTheme);
    // Persist to database
    const formData = new FormData();
    formData.set("theme", newTheme);
    await updatePreferences(formData);
  }

  const options: Array<{ value: "dark" | "light" | "system"; label: string }> = [
    { value: "dark", label: "Dark" },
    { value: "light", label: "Light" },
    { value: "system", label: "System" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Choose your preferred theme. Light mode colors are coming in a future update.
        </p>
        <div className="flex gap-2">
          {options.map((option) => (
            <Button
              key={option.value}
              variant={theme === option.value ? "default" : "secondary"}
              size="sm"
              onClick={() => handleThemeChange(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
