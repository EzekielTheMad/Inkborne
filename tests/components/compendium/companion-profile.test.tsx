import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CompanionProfile } from "@/components/compendium/companion-profile";
import { CompendiumDetail } from "@/components/compendium/compendium-detail";
import { CompendiumBrowser } from "@/components/compendium/compendium-browser";
import { companionDataSchema, COMPANION_ROLE_LABELS } from "@/lib/schemas/content-types/companion";
import { parseCompendiumQuery } from "@/lib/compendium/catalog";
import { getCompendiumEntryDescription, getCompendiumEntryFacts } from "@/lib/compendium/presentation";
import { companionEnvelope, companionOwnerId, companionSystemId, companionId, originalCompanion } from "@/tests/fixtures/companions";

describe("actual read-only companion Library/profile",()=>{
  it.each(["mount","beast_form","summon"] as const)("renders %s declared statistics with no character control/permission",role=>{
    const data=originalCompanion(role), before=JSON.stringify(data);
    render(<CompanionProfile data={data}/>);
    const profile=screen.getByRole("region",{name:"Companion template"});
    expect(within(profile).getByRole("heading",{name:COMPANION_ROLE_LABELS[role]})).toBeVisible();
    expect(within(profile).getByText("30 (+10)")).toBeVisible();expect(within(profile).getByText(/Athletics \+20/)).toBeVisible();
    expect(within(profile).getByText(/Attaching, controlling, transforming and summoning are not available/)).toBeVisible();
    expect(screen.queryByRole("button")).toBeNull();expect(screen.queryByRole("link")).toBeNull();expect(JSON.stringify(data)).toBe(before);
  });
  it("uses actual detail dispatch, own version/foreign shared badge and escaped description",()=>{
    const data=originalCompanion(), injection='<script>window.compromised=true</script><img src=x onerror="alert(1)">';
    data.stat_block.description=injection;
    const row={...companionEnvelope(data),scope:"shared" as const,owner_id:companionId(7),version:2};
    render(<CompendiumDetail entry={row} userId={companionOwnerId} returnHref="/library?category=companions"/>);
    expect(screen.getByRole("region",{name:"Companion template"})).toBeVisible();expect(screen.getByText("Version 2")).toBeVisible();
    expect(screen.getByText("Campaign shared")).toBeVisible();expect(screen.getByText(injection)).toBeVisible();expect(document.querySelector("script,img")).toBeNull();
    expect(screen.queryByText(/Manage content you own/)).toBeNull();expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("link",{name:"Back to Library"})).toHaveAttribute("href","/library?category=companions");
    expect(getCompendiumEntryFacts(row)).toEqual([{label:"Template role",value:"Mount template"},{label:"Size",value:"Small"},{label:"Creature type",value:"construct"}]);
  });
  it("omits absent description and rule sections without adding default statistics",()=>{
    const data=originalCompanion();delete data.stat_block.description;delete data.stat_block.actions;delete data.stat_block.skills;
    const row=companionEnvelope(data);render(<CompendiumDetail entry={row} userId={companionOwnerId} returnHref="/library"/>);
    expect(screen.queryByRole("heading",{name:"Description"})).toBeNull();expect(screen.queryByRole("heading",{name:"Actions"})).toBeNull();
    expect(getCompendiumEntryDescription(row)).toBe("Companion stat template.");expect(companionDataSchema.parse(data)).toEqual(data);
  });
  it("refuses direct invalid profile data instead of rendering a repaired empty block",()=>{
    render(<CompanionProfile data={{schema_version:1,role:"mount",stat_block:{}}}/>);
    expect(screen.getByRole("status")).toHaveTextContent("Companion template unavailable.");expect(screen.queryByRole("heading",{name:"Statistics"})).toBeNull();
  });
  it("exposes the shared category/search/return semantics without nested size/eligibility filters",()=>{
    const query=parseCompendiumQuery({category:"companions",system:companionSystemId});
    render(<CompendiumBrowser systems={[{id:companionSystemId,name:"Original fixture",slug:"fixture",versionLabel:"2014"}]}
      query={query} result={{entries:[companionEnvelope()],total:1,page:1,pageSize:24}} userId={companionOwnerId}/>);
    expect(screen.getByRole("link",{name:"Companions"})).toHaveAttribute("aria-current","page");
    expect(screen.getByLabelText("Search by name")).toHaveAttribute("placeholder","Search companions…");expect(screen.queryByLabelText("Size")).toBeNull();
    expect(screen.getByRole("link",{name:/Original Workshop Companion/})).toHaveAttribute("href",expect.stringContaining("returnTo="));
  });
});
