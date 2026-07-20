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
  const [nonce, setNonce] = useState("");
  const [requiresReauthentication, setRequiresReauthentication] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const passwordsMatch = newPassword === confirmPassword;
  const isValid = newPassword.length >= 8 && passwordsMatch;

  async function handleChangePassword() {
    if (!isValid) return;
    setSaving(true);
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
      ...(requiresReauthentication ? { nonce: nonce.trim() } : {}),
    });

    if (error) {
      if (error.code === "reauthentication_needed") {
        const { error: reauthenticationError } = await supabase.auth.reauthenticate();
        if (reauthenticationError) {
          setMessage({ type: "error", text: reauthenticationError.message });
        } else {
          setRequiresReauthentication(true);
          setMessage({
            type: "success",
            text: `We sent a security code to ${email}. Enter it below to finish changing your password.`,
          });
        }
      } else {
        setMessage({ type: "error", text: error.message });
      }
    } else {
      setPasswordEnabled(true);
      setRequiresReauthentication(false);
      setNonce("");
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

        {requiresReauthentication && (
          <div className="space-y-2">
            <Label htmlFor="passwordNonce">Security Code</Label>
            <Input
              id="passwordNonce"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={nonce}
              onChange={(event) => setNonce(event.target.value)}
              placeholder="Enter the code from your email"
            />
          </div>
        )}

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

        <Button
          onClick={handleChangePassword}
          disabled={saving || !isValid || (requiresReauthentication && !nonce.trim())}
        >
          {saving
            ? passwordEnabled
              ? "Updating..."
              : "Adding login..."
            : requiresReauthentication
              ? "Verify and update password"
            : passwordEnabled
              ? "Update Password"
              : "Add email login"}
        </Button>
      </CardContent>
    </Card>
  );
}
