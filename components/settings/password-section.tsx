"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

interface PasswordSectionProps {
  hasPasswordIdentity: boolean;
  email: string;
}

export function PasswordSection({ hasPasswordIdentity, email }: PasswordSectionProps) {
  const [passwordEnabled, setPasswordEnabled] = useState(hasPasswordIdentity);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const passwordsMatch = newPassword === confirmPassword;
  const isValid = newPassword.length >= 8 && passwordsMatch;

  async function handleChangePassword() {
    if (!isValid) return;
    setSaving(true);
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setPasswordEnabled(true);
      setMessage({
        type: "success",
        text: passwordEnabled
          ? "Password updated successfully"
          : `Email and password login enabled for ${email}`,
      });
      setNewPassword("");
      setConfirmPassword("");
    }
    setSaving(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{passwordEnabled ? "Password" : "Add email & password login"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {passwordEnabled
            ? `Use a password to sign in as ${email}.`
            : `Set a password to add ${email} as another login method for this same Inkborne profile.`}
        </p>
        <div className="space-y-2">
          <Label htmlFor="newPassword">New Password</Label>
          <Input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Minimum 8 characters"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your new password"
          />
          {confirmPassword && !passwordsMatch && (
            <p className="text-xs text-destructive">Passwords do not match</p>
          )}
        </div>

        {message && (
          <p className={`text-sm ${message.type === "error" ? "text-destructive" : "text-accent"}`}>
            {message.text}
          </p>
        )}

        <Button onClick={handleChangePassword} disabled={saving || !isValid}>
          {saving
            ? passwordEnabled
              ? "Updating..."
              : "Adding login..."
            : passwordEnabled
              ? "Update Password"
              : "Add email login"}
        </Button>
      </CardContent>
    </Card>
  );
}
