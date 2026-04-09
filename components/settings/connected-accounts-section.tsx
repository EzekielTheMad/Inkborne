"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";

interface Identity {
  id: string;
  provider: string;
}

interface ConnectedAccountsSectionProps {
  identities: Identity[];
}

const PROVIDERS = [
  { key: "discord", label: "Discord" },
  { key: "google", label: "Google" },
] as const;

export function ConnectedAccountsSection({ identities: initialIdentities }: ConnectedAccountsSectionProps) {
  const [identities, setIdentities] = useState(initialIdentities);
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function isConnected(provider: string) {
    return identities.some((i) => i.provider === provider);
  }

  function getIdentityId(provider: string) {
    return identities.find((i) => i.provider === provider)?.id;
  }

  async function handleConnect(provider: string) {
    setLoading(provider);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.linkIdentity({
      provider: provider as "discord" | "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setMessage({ type: "error", text: error.message });
    }
    setLoading(null);
  }

  async function handleDisconnect(provider: string) {
    const identityId = getIdentityId(provider);
    if (!identityId) return;

    // Prevent disconnecting the last identity
    if (identities.length <= 1) {
      setMessage({ type: "error", text: "Cannot disconnect your only login method" });
      return;
    }

    setLoading(provider);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.unlinkIdentity({ id: identityId } as Parameters<typeof supabase.auth.unlinkIdentity>[0]);
    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setIdentities((prev) => prev.filter((i) => i.id !== identityId));
      setMessage({ type: "success", text: `${provider} disconnected` });
    }
    setLoading(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connected Accounts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {PROVIDERS.map((provider) => {
          const connected = isConnected(provider.key);
          return (
            <div key={provider.key} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-foreground font-medium">{provider.label}</span>
                {connected ? (
                  <Badge variant="secondary">Connected</Badge>
                ) : (
                  <Badge variant="outline">Not connected</Badge>
                )}
              </div>
              {connected ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDisconnect(provider.key)}
                  disabled={loading === provider.key}
                >
                  {loading === provider.key ? "Disconnecting..." : "Disconnect"}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleConnect(provider.key)}
                  disabled={loading === provider.key}
                >
                  {loading === provider.key ? "Connecting..." : "Connect"}
                </Button>
              )}
            </div>
          );
        })}

        {message && (
          <p className={`text-sm ${message.type === "error" ? "text-destructive" : "text-accent"}`}>
            {message.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
