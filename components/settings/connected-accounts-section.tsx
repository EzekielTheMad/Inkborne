"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import {
  buildIdentityCallbackUrl,
  LINKABLE_IDENTITY_PROVIDERS,
  type LinkableIdentityProvider,
} from "@/lib/auth/identity-providers";

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

function toIdentity(identity: {
  id: string;
  identity_id: string;
  user_id: string;
  provider: string;
}): Identity {
  return {
    id: identity.id,
    identityId: identity.identity_id,
    userId: identity.user_id,
    provider: identity.provider,
  };
}

export function ConnectedAccountsSection({
  identities: initialIdentities,
  linkedProvider = null,
  linkErrorProvider = null,
  discordEnabled = false,
}: ConnectedAccountsSectionProps) {
  const [identities, setIdentities] = useState(initialIdentities);
  const [loading, setLoading] = useState<string | null>(null);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState<string | null>(null);
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

  async function handleConnect(provider: LinkableIdentityProvider) {
    setLoading(provider);
    setMessage(null);
    const supabase = createClient();

    const { data: currentData, error: currentError } = await supabase.auth.getUserIdentities();
    if (currentError) {
      setMessage({ type: "error", text: "We couldn't verify your current login methods. Please try again." });
      setLoading(null);
      return;
    }

    const currentIdentities = currentData.identities.map(toIdentity);
    setIdentities(currentIdentities);
    if (currentIdentities.some((identity) => identity.provider === provider)) {
      setMessage({ type: "success", text: `${provider} is already connected` });
      setLoading(null);
      return;
    }

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

  async function handleDisconnect(provider: LinkableIdentityProvider) {
    setLoading(provider);
    setMessage(null);
    const supabase = createClient();

    const { data: currentData, error: currentError } = await supabase.auth.getUserIdentities();
    if (currentError) {
      setMessage({ type: "error", text: "We couldn't verify your current login methods. Please try again." });
      setLoading(null);
      return;
    }

    const currentIdentities = currentData.identities.map(toIdentity);
    setIdentities(currentIdentities);
    const identity = currentData.identities.find((item) => item.provider === provider);
    if (!identity) {
      setMessage({ type: "error", text: `${provider} is no longer connected` });
      setConfirmingDisconnect(null);
      setLoading(null);
      return;
    }

    if (currentIdentities.length <= 1) {
      setMessage({ type: "error", text: "Cannot disconnect your only login method" });
      setConfirmingDisconnect(null);
      setLoading(null);
      return;
    }

    const { error } = await supabase.auth.unlinkIdentity(identity);
    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      const { data: refreshedData, error: refreshedError } = await supabase.auth.getUserIdentities();
      setIdentities(
        refreshedError
          ? currentIdentities.filter((item) => item.id !== identity.id)
          : refreshedData.identities.map(toIdentity),
      );
      setMessage({ type: "success", text: `${provider} disconnected` });
    }
    setConfirmingDisconnect(null);
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
        {LINKABLE_IDENTITY_PROVIDERS.map((provider) => {
          const connected = isConnected(provider.key);
          const available = !provider.requiresDiscordFlag || discordEnabled;
          const confirming = confirmingDisconnect === provider.key;
          return (
            <div key={provider.key} className="space-y-3 rounded-md border border-border/60 p-3">
              <div className="flex items-center justify-between gap-3">
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
                    aria-label={`Disconnect ${provider.label}`}
                    onClick={() => setConfirmingDisconnect(provider.key)}
                    disabled={loading === provider.key || confirming}
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`${available ? "Connect" : "Unavailable"} ${provider.label}`}
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
              {confirming && (
                <div className="space-y-3" role="group" aria-label={`Confirm disconnect ${provider.label}`}>
                  <p className="text-sm text-muted-foreground">
                    You will no longer be able to sign in with {provider.label}. Make sure another
                    login method works before continuing.
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmingDisconnect(null)}
                      disabled={loading === provider.key}
                    >
                      Keep connected
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDisconnect(provider.key)}
                      disabled={loading === provider.key}
                    >
                      {loading === provider.key ? "Disconnecting..." : "Confirm disconnect"}
                    </Button>
                  </div>
                </div>
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
