import Link from "next/link";
import { BookOpen, Plus, Sparkles, Upload } from "lucide-react";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { listOwnedHomebrewBackgrounds } from "@/lib/supabase/homebrew-backgrounds-server";
import { listOwnedHomebrewFeats } from "@/lib/supabase/homebrew-feats-server";
import { listOwnedHomebrewArmors } from "@/lib/supabase/homebrew-armors-server";
import { listOwnedHomebrewWeapons } from "@/lib/supabase/homebrew-weapons-server";
import { listOwnedHomebrewItems } from "@/lib/supabase/homebrew-items-server";
import { listOwnedHomebrewMagicItems } from "@/lib/supabase/homebrew-magic-items-server";
import { listOwnedHomebrewSpells } from "@/lib/supabase/homebrew-spells-server";
import { createClient } from "@/lib/supabase/server";

interface HomebrewPageProps {
  searchParams: Promise<{ created?: string | string[]; updated?: string | string[] }>;
}

export default async function HomebrewPage({ searchParams }: HomebrewPageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const query = await searchParams;
  const [spellsResult, featsResult, backgroundsResult, magicItemsResult, itemsResult, weaponsResult, armorsResult] = await Promise.allSettled([
    listOwnedHomebrewSpells(),
    listOwnedHomebrewFeats(),
    listOwnedHomebrewBackgrounds(),
    listOwnedHomebrewMagicItems(),
    listOwnedHomebrewItems(),
    listOwnedHomebrewWeapons(),
    listOwnedHomebrewArmors(),
  ]);
  const spells = spellsResult.status === "fulfilled" ? spellsResult.value : [];
  const feats = featsResult.status === "fulfilled" ? featsResult.value : [];
  const backgrounds = backgroundsResult.status === "fulfilled" ? backgroundsResult.value : [];
  const armors = armorsResult.status === "fulfilled" ? armorsResult.value : [];
  const weapons = weaponsResult.status === "fulfilled" ? weaponsResult.value : [];
  const items = itemsResult.status === "fulfilled" ? itemsResult.value : [];
  const magicItems = magicItemsResult.status === "fulfilled" ? magicItemsResult.value : [];

  if (spellsResult.status === "rejected") {
    console.error("[HomebrewPage] Failed to load owned homebrew spells", spellsResult.reason);
  }
  if (featsResult.status === "rejected") {
    console.error("[HomebrewPage] Failed to load owned homebrew feats", featsResult.reason);
  }
  if (backgroundsResult.status === "rejected") {
    console.error(
      "[HomebrewPage] Failed to load owned homebrew backgrounds",
      backgroundsResult.reason,
    );
  }
  if (magicItemsResult.status === "rejected") {
    console.error(
      "[HomebrewPage] Failed to load owned homebrew magic items",
      magicItemsResult.reason,
    );
  }

  if (itemsResult.status === "rejected") {
    console.error("[HomebrewPage] Failed to load owned homebrew items", itemsResult.reason);
  }

  if (weaponsResult.status === "rejected") {
    console.error("[HomebrewPage] Failed to load owned homebrew weapons", weaponsResult.reason);
  }

  if (armorsResult.status === "rejected") {
    console.error("[HomebrewPage] Failed to load owned homebrew armor", armorsResult.reason);
  }

  const notice = typeof query.created === "string"
    ? "Private homebrew created."
    : typeof query.updated === "string"
      ? "A new homebrew version was saved. Existing character pins are unchanged."
      : null;
  const completelyEmpty = spells.length === 0
    && feats.length === 0
    && backgrounds.length === 0
    && magicItems.length === 0
    && items.length === 0
    && weapons.length === 0
    && armors.length === 0
    && spellsResult.status === "fulfilled"
    && featsResult.status === "fulfilled"
    && backgroundsResult.status === "fulfilled"
    && magicItemsResult.status === "fulfilled"
    && itemsResult.status === "fulfilled"
    && weaponsResult.status === "fulfilled"
    && armorsResult.status === "fulfilled";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="j-folio">Your rules, one source of truth</p>
          <h1 className="j-display mt-1.5 text-3xl text-foreground sm:text-4xl">Homebrew</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Author homebrew that flows into the same character sheets and gameplay tools as SRD content,
            then share it with the campaigns you choose.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/homebrew/import" className={buttonVariants({ variant: "outline" })}>
            <Upload className="size-4" />
            Import MPMB
          </Link>
          <Link href="/homebrew/feats/new" className={buttonVariants({ variant: "outline" })}>
            <Plus className="size-4" />
            Create feat
          </Link>
          <Link href="/homebrew/backgrounds/new" className={buttonVariants({ variant: "outline" })}>
            <Plus className="size-4" />
            Create background
          </Link>
          <Link href="/homebrew/armors/new" className={buttonVariants({ variant: "outline" })}><Plus className="size-4" />Create armor</Link>
          <Link href="/homebrew/weapons/new" className={buttonVariants({ variant: "outline" })}><Plus className="size-4" />Create weapon</Link>
          <Link href="/homebrew/items/new" className={buttonVariants({ variant: "outline" })}>
            <Plus className="size-4" />
            Create item
          </Link>
          <Link href="/homebrew/magic-items/new" className={buttonVariants({ variant: "outline" })}>
            <Plus className="size-4" />
            Create magic item
          </Link>
          <Link href="/homebrew/spells/new" className={buttonVariants({ variant: "gold" })}>
            <Plus className="size-4" />
            Create spell
          </Link>
        </div>
      </div>

      {notice && (
        <div className="rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent" role="status">
          {notice}
        </div>
      )}

      {completelyEmpty && (
        <div className="j-card-paper flex flex-col items-center px-6 py-14 text-center">
          <div className="rounded-full border border-accent/30 bg-accent/10 p-3 text-accent">
            <Sparkles className="size-6" />
          </div>
          <h2 className="j-display mt-4 text-xl text-foreground">Write your first private rule</h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Start with a spell, feat, background, item, weapon, or magic item. Every change is versioned so character sheets can remain pinned to exactly what they chose.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href="/homebrew/spells/new" className={buttonVariants({ variant: "outline" })}>Create spell</Link>
            <Link href="/homebrew/feats/new" className={buttonVariants({ variant: "outline" })}>Create feat</Link>
            <Link href="/homebrew/backgrounds/new" className={buttonVariants({ variant: "outline" })}>Create background</Link>
            <Link href="/homebrew/armors/new" className={buttonVariants({ variant: "outline" })}>Create armor</Link>
            <Link href="/homebrew/weapons/new" className={buttonVariants({ variant: "outline" })}>Create weapon</Link>
            <Link href="/homebrew/items/new" className={buttonVariants({ variant: "outline" })}>Create item</Link>
            <Link href="/homebrew/magic-items/new" className={buttonVariants({ variant: "outline" })}>Create magic item</Link>
          </div>
        </div>
      )}

      {spellsResult.status === "rejected" ? (
        <HomebrewLoadError label="spells" />
      ) : spells.length > 0 ? (
        <section aria-labelledby="owned-spells-heading" className="space-y-3">
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-accent" />
            <h2 id="owned-spells-heading" className="j-folio">My spells</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {spells.map((spell) => (
              <Link
                key={spell.id}
                href={`/homebrew/spells/${spell.id}/edit`}
                className="j-card-paper group p-5 transition-colors hover:border-accent/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="j-display truncate text-lg text-foreground group-hover:text-accent">{spell.name}</h3>
                    <p className="mt-1 text-xs capitalize text-muted-foreground">
                      {spell.data.level === 0 ? "Cantrip" : `Level ${spell.data.level}`} · {spell.data.school}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Badge variant="outline">
                      {spell.scope === "shared"
                        ? `Shared · ${spell.sharedCampaignCount} ${spell.sharedCampaignCount === 1 ? "campaign" : "campaigns"}`
                        : "Private"}
                    </Badge>
                    <Badge variant="secondary">v{spell.version}</Badge>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {spell.data.classes.map((classSlug) => (
                    <span key={classSlug} className="rounded-full bg-muted px-2 py-0.5 text-[10px] capitalize text-muted-foreground">
                      {classSlug}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {featsResult.status === "rejected" ? (
        <HomebrewLoadError label="feats" />
      ) : feats.length > 0 ? (
        <section aria-labelledby="owned-feats-heading" className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-accent" />
            <h2 id="owned-feats-heading" className="j-folio">My feats</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {feats.map((feat) => (
              <Link
                key={feat.id}
                href={`/homebrew/feats/${feat.id}/edit`}
                className="j-card-paper group p-5 transition-colors hover:border-accent/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="j-display truncate text-lg text-foreground group-hover:text-accent">{feat.name}</h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {feat.data.description}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Badge variant="outline">
                      {feat.scope === "shared"
                        ? `Shared · ${feat.sharedCampaignCount} ${feat.sharedCampaignCount === 1 ? "campaign" : "campaigns"}`
                        : "Private"}
                    </Badge>
                    <Badge variant="secondary">v{feat.version}</Badge>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {backgroundsResult.status === "rejected" ? (
        <HomebrewLoadError label="backgrounds" />
      ) : backgrounds.length > 0 ? (
        <section aria-labelledby="owned-backgrounds-heading" className="space-y-3">
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-accent" />
            <h2 id="owned-backgrounds-heading" className="j-folio">My backgrounds</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {backgrounds.map((background) => (
              <Link
                key={background.id}
                href={`/homebrew/backgrounds/${background.id}/edit`}
                className="j-card-paper group p-5 transition-colors hover:border-accent/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="j-display truncate text-lg text-foreground group-hover:text-accent">
                      {background.name}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {background.data.feature.name}: {background.data.feature.description}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Badge variant="outline">
                      {background.scope === "shared"
                        ? `Shared · ${background.sharedCampaignCount} ${background.sharedCampaignCount === 1 ? "campaign" : "campaigns"}`
                        : "Private"}
                    </Badge>
                    <Badge variant="secondary">v{background.version}</Badge>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {background.data.skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full bg-muted px-2 py-0.5 text-[10px] capitalize text-muted-foreground"
                    >
                      {skill.replaceAll("-", " ")}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {itemsResult.status === "rejected" ? (
        <HomebrewLoadError label="items" />
      ) : items.length > 0 ? (
        <section aria-labelledby="owned-items-heading" className="space-y-3">
          <h2 id="owned-items-heading" className="j-folio">My items</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {items.map((item) => (
              <Link key={item.id} href={`/homebrew/items/${item.id}/edit`}
                className="j-card-paper group p-5 transition-colors hover:border-accent/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="j-display truncate text-lg text-foreground group-hover:text-accent">{item.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{item.data.equipment_category}</p>
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.data.description}</p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Badge variant="outline">Private</Badge>
                    <Badge variant="secondary">v{item.version}</Badge>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {weaponsResult.status === "rejected" ? (
        <HomebrewLoadError label="weapons" />
      ) : weapons.length > 0 ? (
        <section aria-labelledby="owned-weapons-heading" className="space-y-3">
          <h2 id="owned-weapons-heading" className="j-folio">My weapons</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {weapons.map((weapon) => (
              <Link key={weapon.id} href={`/homebrew/weapons/${weapon.id}/edit`}
                className="j-card-paper group p-5 transition-colors hover:border-accent/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="j-display truncate text-lg text-foreground group-hover:text-accent">{weapon.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{weapon.data.weapon_category} &middot; {weapon.data.weapon_range}</p>
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{weapon.data.damage ? `${weapon.data.damage.dice} ${weapon.data.damage.type}` : "No damage authored"}</p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Badge variant="outline">Private</Badge>
                    <Badge variant="secondary">v{weapon.version}</Badge>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {armorsResult.status === "rejected" ? (
        <HomebrewLoadError label="armor" />
      ) : armors.length > 0 ? (
        <section aria-labelledby="owned-armors-heading" className="space-y-3">
          <h2 id="owned-armors-heading" className="j-folio">My armor</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {armors.map((armor) => (
              <Link key={armor.id} href={`/homebrew/armors/${armor.id}/edit`}
                className="j-card-paper group p-5 transition-colors hover:border-accent/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="j-display truncate text-lg text-foreground group-hover:text-accent">{armor.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{armor.data.armor_category}</p>
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {armor.data.armor_category === "Shield"
                        ? `Shield AC bonus +${armor.data.armor_class.base}`
                        : `AC ${armor.data.armor_class.base}${armor.data.armor_class.dex_bonus
                          ? armor.data.armor_class.max_bonus === null ? " + Dex" : ` + Dex (max +${armor.data.armor_class.max_bonus})`
                          : ""}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Badge variant="outline">Private</Badge>
                    <Badge variant="secondary">v{armor.version}</Badge>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {magicItemsResult.status === "rejected" ? (
        <HomebrewLoadError label="magic items" />
      ) : magicItems.length > 0 ? (
        <section aria-labelledby="owned-magic-items-heading" className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-accent" />
            <h2 id="owned-magic-items-heading" className="j-folio">My magic items</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {magicItems.map((item) => (
              <Link
                key={item.id}
                href={`/homebrew/magic-items/${item.id}/edit`}
                className="j-card-paper group p-5 transition-colors hover:border-accent/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="j-display truncate text-lg text-foreground group-hover:text-accent">
                      {item.name}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.data.rarity} · {item.data.requires_attunement
                        ? "Requires attunement"
                        : "No attunement required"}
                    </p>
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {item.data.description}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Badge variant="outline">Private</Badge>
                    <Badge variant="secondary">v{item.version}</Badge>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function HomebrewLoadError({ label }: { label: string }) {
  return (
    <div className="j-card-paper p-8 text-center" role="alert">
      <p className="font-medium text-foreground">Your homebrew {label} could not be loaded.</p>
      <p className="mt-2 text-sm text-muted-foreground">Refresh the page to try again.</p>
    </div>
  );
}
