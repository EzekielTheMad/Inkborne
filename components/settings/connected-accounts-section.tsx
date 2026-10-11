"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

const UNEXPECTED_AUTH_ERROR = "Something went wrong while updating your login methods. Please try again.";

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

function isUsableLoginMethod(provider: string, discordEnabled: boolean): boolean {
  return provider === "email"
    || provider === "google"
    || (provider === "discord" && discordEnabled);
}

export function ConnectedAccountsSection({
  identities: initialIdentities,
  linkedProvider = null,
  linkErrorProvider = null,
  discordEnabled = false,
}: ConnectedAccountsSectionProps) {
  const router = useRouter();
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

  useEffect(() => {
    if (!linkedProvider && !linkErrorProvider) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("linked");
    url.searchParams.delete("linkError");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, [linkedProvider, linkErrorProvider]);

  function isConnected(provider: string) {
    return identities.some((i) => i.provider === provider);
  }

  async function handleConnect(provider: LinkableIdentityProvider) {
    setLoading(provider);
    setMessage(null);
    try {
      const supabase = createClient();
      const { data: currentData, error: currentError } = await supabase.auth.getUserIdentities();
      if (currentError) {
        setMessage({ type: "error", text: "We couldn't verify your current login methods. Please try again." });
        return;
      }

      const currentIdentities = currentData.identities.map(toIdentity);
      setIdentities(currentIdentities);
      if (currentIdentities.some((identity) => identity.provider === provider)) {
        setMessage({ type: "success", text: `${provider} is already connected` });
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
      } else if (data.url) {
        window.location.assign(data.url);
      } else {
        setMessage({ type: "error", text: `Unable to start ${provider} linking` });
      }
    } catch {
      setMessage({ type: "error", text: UNEXPECTED_AUTH_ERROR });
    } finally {
      setLoading(null);
    }
  }

  async function handleDisconnect(provider: LinkableIdentityProvider) {
    setLoading(provider);
    setMessage(null);
    try {
      const supabase = createClient();
      const { data: currentData, error: currentError } = await supabase.auth.getUserIdentities();
      if (currentError) {
        setMessage({ type: "error", text: "We couldn't verify your current login methods. Please try again." });
        return;
      }

      const currentIdentities = currentData.identities.map(toIdentity);
      setIdentities(currentIdentities);
      const identity = currentData.identities.find((item) => item.provider === provider);
      if (!identity) {
        setMessage({ type: "error", text: `${provider} is no longer connected` });
        return;
      }

      const remainingIdentities = currentIdentities.filter((item) => item.id !== identity.id);
      if (!remainingIdentities.some((item) => isUsableLoginMethod(item.provider, discordEnabled))) {
        setMessage({ type: "error", text: "Cannot disconnect your only login method" });
        return;
      }

      const { error } = await supabase.auth.unlinkIdentity(identity);
      if (error) {
        setMessage({ type: "error", text: error.message });
      } else {
        let reconciledIdentities = remainingIdentities;
        try {
          const { data: refreshedData, error: refreshedError } = await supabase.auth.getUserIdentities();
          if (!refreshedError) reconciledIdentities = refreshedData.identities.map(toIdentity);
        } catch {
          // The successful unlink remains authoritative when follow-up reconciliation rejects.
        }
        setIdentities(reconciledIdentities);
        setMessage({ type: "success", text: `${provider} disconnected` });
        router.refresh();
      }
    } catch {
      setMessage({ type: "error", text: UNEXPECTED_AUTH_ERROR });
    } finally {
      setConfirmingDisconnect(null);
      setLoading(null);
    }
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
          const confirmationId = `disconnect-${provider.key}-confirmation`;
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
                    aria-expanded={confirming}
                    aria-controls={confirming ? confirmationId : undefined}
                    disabled={loading !== null || confirming}
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`${available ? "Connect" : "Unavailable"} ${provider.label}`}
                    onClick={() => handleConnect(provider.key)}
                    disabled={loading !== null || !available}
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
                <div
                  id={confirmationId}
                  className="space-y-3"
                  role="group"
                  aria-label={`Confirm disconnect ${provider.label}`}
                  aria-live="polite"
                >
                  <p className="text-sm text-muted-foreground">
                    You will no longer be able to sign in with {provider.label}. Make sure another
                    login method works before continuing.
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmingDisconnect(null)}
                      disabled={loading !== null}
                    >
                      Keep connected
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDisconnect(provider.key)}
                      disabled={loading !== null}
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
          <p
            role={message.type === "error" ? "alert" : "status"}
            className={`text-sm ${message.type === "error" ? "text-destructive" : "text-accent"}`}
          >
            {message.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
