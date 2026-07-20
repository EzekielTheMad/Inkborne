export const LINKABLE_IDENTITY_PROVIDERS = [
  { key: "discord", label: "Discord", requiresDiscordFlag: true },
  { key: "google", label: "Google", requiresDiscordFlag: false },
] as const;

export type LinkableIdentityProvider = (typeof LINKABLE_IDENTITY_PROVIDERS)[number]["key"];

export function isLinkableIdentityProvider(value: string | null): value is LinkableIdentityProvider {
  return LINKABLE_IDENTITY_PROVIDERS.some((provider) => provider.key === value);
}

export function buildIdentityCallbackUrl(origin: string, provider: LinkableIdentityProvider) {
  const callbackUrl = new URL("/auth/callback", origin);
  callbackUrl.searchParams.set("next", "/settings");
  callbackUrl.searchParams.set("linked", provider);
  return callbackUrl.toString();
}
