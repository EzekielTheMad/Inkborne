"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";

interface Identity {
  id: string;
  identityId: string;
  userId: string;
  provider: string;
}

interface ConnectedAccountsSectionProps {
  identities: Identity[];
  linkedProvider?: string | null;
  linkErrorProvider?: string | null;
  discordEnabled?: boolean;
}

const PROVIDERS = [
  { key: "discord", label: "Discord" },
  { key: "google", label: "Google" },
] as const;

export function buildIdentityCallbackUrl(origin: string, provider: "discord" | "google") {
  const callbackUrl = new URL("/auth/callback", origin);
  callbackUrl.searchParams.set("next", "/settings");
  callbackUrl.searchParams.set("linked", provider);
  return callbackUrl.toString();
}

export function ConnectedAccountsSection({
  identities: initialIdentities,
  linkedProvider = null,
  linkErrorProvider = null,
  discordEnabled = false,
}: ConnectedAccountsSectionProps) {
  const [identities, setIdentities] = useState(initialIdentities);
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    linkedProvider
      ? { type: "success", text: `${linkedProvider} connected to this Inkborne profile` }
      : linkErrorProvider
        ? { type: "error", text: `We couldn't connect ${linkErrorProvider}. Please try again.` }
        : null,
  );

  function isConnected(provider: string) {
    return identities.some((i) => i.provider === provider);
  }

  function getIdentity(provider: string) {
    return identities.find((i) => i.provider === provider);
  }

  async function handleConnect(provider: "discord" | "google") {
    setLoading(provider);
    setMessage(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.linkIdentity({
      provider,
      options: {
        redirectTo: buildIdentityCallbackUrl(window.location.origin, provider),
        skipBrowserRedirect: true,
      },
    });
    if (error) {
      setMessage({ type: "error", text: error.message });
      setLoading(null);
    } else if (data.url) {
      window.location.assign(data.url);
    } else {
      setMessage({ type: "error", text: `Unable to start ${provider} linking` });
      setLoading(null);
    }
  }

  async function handleDisconnect(provider: string) {
    const identity = getIdentity(provider);
    if (!identity) return;

    // Prevent disconnecting the last identity
    if (identities.length <= 1) {
      setMessage({ type: "error", text: "Cannot disconnect your only login method" });
      return;
    }

    setLoading(provider);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.unlinkIdentity({
      id: identity.id,
      identity_id: identity.identityId,
      user_id: identity.userId,
      provider: identity.provider,
    });
    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setIdentities((prev) => prev.filter((i) => i.id !== identity.id));
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
        <p className="text-sm leading-relaxed text-muted-foreground">
          Connect additional sign-in methods while logged in. Each one opens this same profile,
          characters, and campaigns.
        </p>
        {PROVIDERS.map((provider) => {
          const connected = isConnected(provider.key);
          const available = provider.key !== "discord" || discordEnabled;
          return (
            <div key={provider.key} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-foreground font-medium">{provider.label}</span>
                {connected ? (
                  <Badge variant="secondary">Connected</Badge>
                ) : !available ? (
                  <Badge variant="outline">Setup required</Badge>
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
                  disabled={loading === provider.key || !available}
                >
                  {!available
                    ? "Unavailable"
                    : loading === provider.key
                      ? "Connecting..."
                      : "Connect"}
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
