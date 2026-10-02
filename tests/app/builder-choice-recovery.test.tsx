import { Activity } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RaceStepClient } from "@/app/(app)/characters/[id]/builder/race/race-step-client";
import { ClassStepClient } from "@/app/(app)/characters/[id]/builder/class/class-step-client";
import { BackgroundStepClient } from "@/app/(app)/characters/[id]/builder/background/background-step-client";
import type { ContentEntry } from "@/components/builder/content-browser";

const mocks = vi.hoisted(() => ({ mobile:false, update: vi.fn(), canonical: vi.fn(), insert: vi.fn(), remove: vi.fn(), refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh, push: mocks.push }) }));
vi.mock("@/lib/supabase/character-client", () => ({ updateCharacter: mocks.update, updateCharacterAndReturn: mocks.canonical }));
vi.mock("@/lib/supabase/content-refs-client", () => ({ insertContentRef: mocks.insert, removeContentRefById: mocks.remove }));
vi.mock("@/lib/supabase/background-selection-client", () => ({ setCharacterBackground: vi.fn() }));
vi.mock("@/app/(app)/characters/[id]/builder/class/actions", () => ({ searchUsableFeatsAction: vi.fn(), setCharacterAsiChoiceAction: vi.fn() }));
vi.mock("@/components/builder/stat-preview", () => ({ StatPreview: () => null }));
vi.mock("@/lib/builder/use-is-mobile", () => ({ useIsMobile: () => mocks.mobile }));

const human: ContentEntry = { id: "human", name: "Human", slug: "human", content_type: "race", data: {}, effects: [], version: 1, source: "srd" };
const elf: ContentEntry = { ...human, id: "elf", name: "Elf", slug: "elf" };
const woodElf: ContentEntry = { ...human, id: "wood-elf", name: "Wood Elf", slug: "wood-elf", content_type: "subrace", data: { parent_race: "elf" } };
const character = { id: "char-1", name: "Fresh hero", level: 1, base_stats: {}, choices: {} };
function race(choices = {}) { return render(<RaceStepClient characterId="char-1" character={{ ...character, choices }} races={[human, elf]} subraces={[woodElf]} traits={[]} contentRefs={[]} schema={undefined} />); }

describe("builder choice error recovery with real selection controls", () => {
  beforeEach(() => { mocks.mobile=false; vi.resetAllMocks(); mocks.update.mockResolvedValue(undefined); mocks.insert.mockResolvedValue(undefined); mocks.remove.mockResolvedValue(undefined); vi.spyOn(console, "error").mockImplementation(() => {}); });
  afterEach(() => vi.restoreAllMocks());

  it("reports a failed race write without exposing server details", async () => {
    mocks.update.mockRejectedValueOnce(new Error("private database detail")); race();
    fireEvent.click(screen.getByRole("button", { name: "Preview Human" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Race" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Reload the character");
    expect(screen.getByRole("alert")).not.toHaveTextContent("private database detail");
    expect(mocks.insert).not.toHaveBeenCalled(); expect(mocks.refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Preview Human" })).toBeEnabled();
  });

  it("warns about a partially saved race instead of implying a rollback", async () => {
    mocks.insert.mockRejectedValueOnce(new Error("ref failed")); race();
    fireEvent.click(screen.getByRole("button", { name: "Preview Human" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Race" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Some changes may have saved");
    expect(mocks.update).toHaveBeenCalledTimes(1); expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("locks competing race actions and navigation while selecting a subrace", async () => {
    let resolve!: () => void; mocks.update.mockReturnValueOnce(new Promise<void>((done) => { resolve = done; }));
    race({ race: "elf" });
    fireEvent.click(screen.getByRole("button", { name: "Select Wood Elf" }));
    expect(screen.getByRole("button", { name: "Change Race" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next: Class" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Change Race" }));
    expect(mocks.update).toHaveBeenCalledTimes(1);
    await act(async () => resolve());
    await waitFor(() => expect(screen.getByRole("button", { name: "Change Race" })).toBeEnabled());
    expect(mocks.insert).toHaveBeenCalledTimes(1);
  });

  it("reports a fresh class selection failure through the real preview dialog", async () => {
    mocks.canonical.mockRejectedValueOnce(new Error("private server detail"));
    const fighter = { ...human, id: "fighter", name: "Fighter", slug: "fighter", content_type: "class", data: { hit_die: 10 } };
    render(<ClassStepClient characterId="char-1" character={character} classes={[fighter]} subclasses={[]} features={[]} feats={[]} spells={[]} contentRefs={[]} schema={undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Preview Fighter" }));
    fireEvent.click(screen.getByRole("button", { name: "Pick this class" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This class change could not be confirmed");
    expect(screen.getByRole("alert")).not.toHaveTextContent("private server detail");
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("announces failed background subchoices and exposes selection state", async () => {
    const background: ContentEntry = { ...human, id: "soldier", name: "Soldier", slug: "soldier", content_type: "background", effects: [{ type: "choice", choose: 1, from: ["skill-athletics", "skill-stealth"], grant_type: "proficiency", choice_id: "soldier-skill" }] };
    mocks.update.mockRejectedValueOnce(new Error("offline"));
    render(<BackgroundStepClient characterId="char-1" character={{ ...character, choices: { background: "soldier" } }} backgrounds={[background]} contentRefs={[{ id: "pin", content_id: "soldier", context: {}, choice_source: null, content_definitions: background }]} schema={undefined} />);
    expect(screen.getByRole("button", { name: "Athletics" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "Athletics" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("background choices could not be confirmed");
    expect(screen.getByRole("button", { name: "Athletics" })).toHaveAttribute("aria-pressed", "false");
  });
  it("shows the pinned race's data and choices instead of a newer catalog revision", () => {
    const pin = { ...human, name: "Pinned Human", data: { description: "Authorized old description." }, effects: [{ type: "choice" as const, choose: 1, from: ["skill-athletics"], grant_type: "proficiency", choice_id: "old-human-skill" }] };
    const latest = { ...human, version: 2, data: { description: "New catalog description." }, effects: [{ type: "choice" as const, choose: 1, from: ["skill-stealth"], grant_type: "proficiency", choice_id: "new-human-skill" }] };
    render(<RaceStepClient characterId="char-1" character={{ ...character, choices: { race: "human" } }} races={[latest]} subraces={[]} traits={[]} contentRefs={[{ id: "pin", content_id: "human", context: {}, choice_source: null, content_definitions: pin }]} schema={undefined} />);
    expect(screen.getByText("Authorized old description.")).toBeInTheDocument();
    expect(screen.queryByText("New catalog description.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Athletics" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stealth" })).not.toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("uses a saved race trait's pinned options instead of its mutable catalog row", () => {
    const raceContent:ContentEntry={...human,data:{traits:["tool-training"]}};
    const savedTrait:ContentEntry={...human,id:"tool-training",slug:"tool-training",name:"Pinned Tool Training",content_type:"trait",effects:[{type:"choice",choose:1,from:["tool-smith"],grant_type:"proficiency",choice_id:"tool-training"}]};
    const newerTrait:ContentEntry={...savedTrait,name:"New Tool Training",version:2,effects:[{...savedTrait.effects[0],from:["tool-dice"]} as typeof savedTrait.effects[number]]};
    render(<RaceStepClient characterId="char-1" character={{...character,choices:{race:"human"}}} races={[raceContent]} subraces={[]} traits={[newerTrait]} contentRefs={[raceContent,savedTrait].map(content=>({id:"pin-"+content.id,content_id:content.id,context:{},choice_source:null,content_definitions:content}))} schema={undefined}/>);
    expect(screen.getByRole("button",{name:"Tool Smith"})).toBeVisible();
    expect(screen.queryByRole("button",{name:"Tool Dice"})).not.toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("retains a removed pinned race trait and refuses conflicting trait snapshots", () => {
    const raceContent:ContentEntry={...human,data:{traits:["tool-training"]}};
    const trait:ContentEntry={...human,id:"tool-training",slug:"tool-training",name:"Pinned Tool Training",content_type:"trait",data:{description:"Authorized training."}};
    const pin=(content:ContentEntry,index=0)=>({id:"pin-"+content.id+index,content_id:content.id,context:{},choice_source:null,content_definitions:content});
    const props={characterId:"char-1",character:{...character,choices:{race:"human"}},races:[raceContent],subraces:[],traits:[],schema:undefined};
    const rendered=render(<RaceStepClient {...props} contentRefs={[pin(raceContent),pin(trait)]}/>);
    expect(screen.getByText("Pinned Tool Training")).toBeVisible();
    expect(screen.getByText("Authorized training.")).toBeVisible();
    rendered.rerender(<RaceStepClient {...props} contentRefs={[pin(raceContent),pin(trait),pin({...trait,name:"Conflicting Training",version:2},1)]}/>);
    expect(screen.getByRole("alert")).toHaveTextContent("Multiple snapshots");
    expect(screen.queryByText("Pinned Tool Training")).not.toBeInTheDocument();
    expect(screen.queryByText("Conflicting Training")).not.toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Change Race"})).toBeDisabled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("keeps an authorized pinned race visible when it is absent from the current catalog", () => {
    render(<RaceStepClient characterId="char-1" character={{ ...character, choices: { race: "human" } }} races={[]} subraces={[]} traits={[]} contentRefs={[{ id: "pin", content_id: "human", context: {}, choice_source: null, content_definitions: human }]} schema={undefined} />);
    expect(screen.getByText("Human")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change Race" })).toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("does not display a subrace belonging to a different selected race as compatible", () => {
    race({ race: "human", subrace: "wood-elf" });
    expect(screen.getByRole("alert")).toHaveTextContent("does not belong");
    expect(screen.queryByRole("button", { name: "Change Subrace" })).not.toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("shows an existing pinned subrace even when no current catalog subraces remain", () => {
    const pin = { ...woodElf, data: { ...woodElf.data, description: "Pinned woodland heritage." } };
    render(<RaceStepClient characterId="char-1" character={{ ...character, choices: { race: "elf", subrace: "wood-elf" } }} races={[elf]} subraces={[]} traits={[]} contentRefs={[{ id: "pin", content_id: "wood-elf", context: {}, choice_source: null, content_definitions: pin }]} schema={undefined} />);
    expect(screen.getByText("Pinned woodland heritage.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change Subrace" })).toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("does not arbitrarily choose between conflicting saved snapshots", () => {
    const pins = [human, { ...human, name: "Other Human snapshot" }].map((content, index) => ({ id: "pin-" + index, content_id: "human", context: {}, choice_source: null, content_definitions: content }));
    render(<RaceStepClient characterId="char-1" character={{ ...character, choices: { race: "human" } }} races={[human]} subraces={[]} traits={[]} contentRefs={pins} schema={undefined} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Multiple snapshots");
    expect(screen.getByRole("button", { name: "Preview Human" })).toBeDisabled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("uses pinned class and referenced feature snapshots in the actual level rail", () => {
    const pinnedFeature: ContentEntry = { ...human, id: "second-wind", slug: "second-wind", name: "Pinned Second Wind", content_type: "feature", data: { description: "Pinned recovery." } };
    const pinnedClass: ContentEntry = { ...human, id: "fighter", slug: "fighter", name: "Pinned Fighter", content_type: "class", data: { hit_die: 10, levels: [{ level: 1, features: ["second-wind"] }] } };
    const pins = [pinnedClass, pinnedFeature].map(content => ({ id: "pin-" + content.id, content_id: content.id, context: {}, choice_source: null, content_definitions: content }));
    render(<ClassStepClient characterId="char-1" character={{ ...character, choices: { classes: [{ slug: "fighter", level: 1 }] } }} classes={[{ ...pinnedClass, name: "Catalog Fighter", version: 2, data: { hit_die: 12, levels: [] } }]} subclasses={[]} features={[{ ...pinnedFeature, name: "Catalog Second Wind", version: 2 }]} feats={[]} spells={[]} contentRefs={pins} schema={undefined} />);
    expect(screen.getAllByText("Pinned Fighter").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pinned Second Wind").length).toBeGreaterThan(0);
    expect(screen.queryByText("Catalog Fighter")).not.toBeInTheDocument();
    expect(screen.queryByText("Catalog Second Wind")).not.toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("keeps a pinned class absent from the catalog visible in its level rail", () => {
    const pinnedClass: ContentEntry = { ...human, id: "fighter", slug: "fighter", name: "Pinned Fighter", content_type: "class", data: { hit_die: 10, levels: [] } };
    render(<ClassStepClient characterId="char-1" character={{ ...character, choices: { classes: [{ slug: "fighter", level: 1 }] } }} classes={[]} subclasses={[]} features={[]} feats={[]} spells={[]} contentRefs={[{ id: "pin", content_id: "fighter", context: {}, choice_source: null, content_definitions: pinnedClass }]} schema={undefined} />);
    expect(screen.getAllByText("Pinned Fighter").length).toBeGreaterThan(0);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("does not pick between conflicting pinned class definitions", () => {
    const pinnedClass: ContentEntry = { ...human, id: "fighter", slug: "fighter", name: "Pinned Fighter", content_type: "class", data: { hit_die: 10, levels: [] } };
    const pins = [pinnedClass, { ...pinnedClass, version: 2 }].map((content, i) => ({ id: "pin-" + i, content_id: content.id, context: {}, choice_source: null, content_definitions: content }));
    render(<ClassStepClient characterId="char-1" character={{ ...character, choices: { classes: [{ slug: "fighter", level: 1 }] } }} classes={[pinnedClass]} subclasses={[]} features={[]} feats={[]} spells={[]} contentRefs={pins} schema={undefined} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Multiple saved snapshots");
    expect(screen.queryByText("Pinned Fighter")).not.toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("shows the pinned subclass even when the catalog changes its parent and level features", () => {
    const cls: ContentEntry = { ...human, id: "fighter", slug: "fighter", name: "Fighter", content_type: "class", data: { hit_die: 10, levels: [] } };
    const sub: ContentEntry = { ...human, id: "champion", slug: "champion", name: "Pinned Champion", content_type: "subclass", data: { parent_class: "fighter", levels: [] } };
    render(<ClassStepClient characterId="char-1" character={{ ...character, choices: { classes: [{ slug: "fighter", level: 3, subclass: "champion" }] } }} classes={[cls]} subclasses={[{ ...sub, name: "Catalog Champion", version: 2, data: { parent_class: "wizard", levels: [] } }]} features={[]} feats={[]} spells={[]} contentRefs={[{ id: "pin", content_id: sub.id, context: { source: "subclass", class: "fighter" }, choice_source: null, content_definitions: sub }]} schema={undefined} />);
    expect(screen.getAllByText("Pinned Champion").length).toBeGreaterThan(0);
    expect(screen.queryByText("Catalog Champion")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("refuses editing a selected subclass belonging to another class", () => {
    const cls: ContentEntry = { ...human, id: "fighter", slug: "fighter", name: "Fighter", content_type: "class", data: { hit_die: 10, levels: [] } };
    const sub: ContentEntry = { ...human, id: "champion", slug: "champion", name: "Wrong Champion", content_type: "subclass", data: { parent_class: "wizard", levels: [] } };
    render(<ClassStepClient characterId="char-1" character={{ ...character, choices: { classes: [{ slug: "fighter", level: 3, subclass: "champion" }] } }} classes={[cls]} subclasses={[sub]} features={[]} feats={[]} spells={[]} contentRefs={[{ id: "pin", content_id: sub.id, context: {}, choice_source: null, content_definitions: sub }]} schema={undefined} />);
    expect(screen.getByRole("alert")).toHaveTextContent("does not belong");
    expect(screen.queryByRole("button", { name: /Remove Fighter/i })).not.toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("allows explicit recovery of unavailable saved choices without silently clearing them", async () => {
    const background: ContentEntry = { ...human, id:"soldier",slug:"soldier",name:"Soldier",content_type:"background",effects:[{type:"choice",choose:1,from:["skill-athletics"],grant_type:"proficiency",choice_id:"skill"}] };
    mocks.update.mockRejectedValueOnce(new Error("offline"));
    render(<BackgroundStepClient characterId="char-1" character={{...character,choices:{background:"soldier",resolved_choices:{skill:["skill-removed"]}}}} backgrounds={[background]} contentRefs={[{id:"pin",content_id:background.id,context:{},choice_source:null,content_definitions:background}]} schema={undefined}/>);
    expect(screen.getByRole("button",{name:"Athletics"})).toBeDisabled();
    expect(mocks.update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button",{name:"Clear saved selections"}));
    await screen.findByText(/background choices could not be confirmed/);
    await waitFor(()=>expect(screen.getByRole("button",{name:"Clear saved selections"})).toBeEnabled());
    expect(screen.getByRole("button",{name:"Athletics"})).toBeDisabled();
    fireEvent.click(screen.getByRole("button",{name:"Clear saved selections"}));
    await waitFor(()=>expect(screen.queryByRole("button",{name:"Clear saved selections"})).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button",{name:"Athletics"}));
    await waitFor(()=>expect(mocks.update).toHaveBeenCalledTimes(3));
    expect(mocks.update.mock.calls[0][1].choices.resolved_choices).toEqual({skill:[]});
    expect(mocks.update.mock.calls[2][1].choices.resolved_choices).toEqual({skill:["skill-athletics"]});
  });

  it("shows first-level class choices even when the level has no feature rows", async () => {
    const cls:ContentEntry={...human,id:"fighter",slug:"fighter",name:"Fighter",content_type:"class",data:{hit_die:10,levels:[{level:1,features:[]}]},effects:[{type:"choice",choose:1,from:["skill-athletics"],grant_type:"proficiency",choice_id:"fighter-skill"}]};
    render(<ClassStepClient characterId="char-1" character={{...character,choices:{classes:[{slug:"fighter",level:1}]}}} classes={[cls]} subclasses={[]} features={[]} feats={[]} spells={[]} contentRefs={[{id:"pin",content_id:cls.id,context:{},choice_source:null,content_definitions:cls}]} schema={undefined}/>);
    fireEvent.click(screen.getByRole("button",{name:"Athletics"}));
    await waitFor(()=>expect(mocks.update).toHaveBeenCalledOnce());
    expect(mocks.update.mock.calls[0][1].choices.resolved_choices).toEqual({"fighter-skill":["skill-athletics"]});
    expect(screen.getByLabelText("Choice made")).toBeVisible();
  });

  it("does not mark unavailable first-level class selections as chosen", () => {
    const feature:ContentEntry={...human,id:"training",slug:"training",name:"Training",content_type:"feature"};
    const cls:ContentEntry={...human,id:"fighter",slug:"fighter",name:"Fighter",content_type:"class",data:{hit_die:10,levels:[{level:1,features:["training"]}]},effects:[{type:"choice",choose:1,from:["skill-athletics"],grant_type:"proficiency",choice_id:"fighter-skill"}]};
    render(<ClassStepClient characterId="char-1" character={{...character,choices:{classes:[{slug:"fighter",level:1}],resolved_choices:{"fighter-skill":["skill-removed"]}}}} classes={[cls]} subclasses={[]} features={[feature]} feats={[]} spells={[]} contentRefs={[cls,feature].map(content=>({id:"pin-"+content.id,content_id:content.id,context:{},choice_source:null,content_definitions:content}))} schema={undefined}/>);
    expect(screen.getByLabelText("Choice not yet made")).toBeVisible();
    expect(screen.queryByLabelText("Choice made")).not.toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Clear saved selections"})).toBeEnabled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it.each([false, true])("does not treat a failed level-up HP save as completed (hidden=%s)", async (hidden) => {
    let rejectSave!:(error:Error)=>void;
    mocks.update.mockReturnValueOnce(new Promise<void>((_,reject)=>{rejectSave=reject}));
    const cls:ContentEntry={...human,id:"fighter",slug:"fighter",name:"Fighter",content_type:"class",data:{hit_die:10,levels:[{level:1,features:[]},{level:2,features:[]}]}};
    const view=(mode:"visible"|"hidden")=><Activity mode={mode}><ClassStepClient characterId="char-1" character={{...character,choices:{classes:[{slug:"fighter",level:1}]}}} classes={[cls]} subclasses={[]} features={[]} feats={[]} spells={[]} contentRefs={[{id:"pin",content_id:cls.id,context:{},choice_source:null,content_definitions:cls}]} schema={undefined}/></Activity>;
    const rendered=render(view("visible"));
    fireEvent.click(screen.getByRole("button",{name:/Level up Fighter to level 2/i}));
    fireEvent.click(screen.getByRole("radio",{name:"Manual"}));
    fireEvent.change(screen.getByRole("spinbutton",{name:"Manual HP value"}),{target:{value:"3"}});
    fireEvent.keyDown(screen.getByRole("spinbutton",{name:"Manual HP value"}),{key:"Enter"});
    expect(mocks.update).toHaveBeenCalledOnce();
    if(hidden) rendered.rerender(view("hidden"));
    await act(async()=>rejectSave(new Error("offline")));
    if(hidden) rendered.rerender(view("visible"));
    expect(screen.getByRole("alert")).toHaveTextContent("class change could not be confirmed");
    expect(screen.getByRole("button",{name:/Confirm level 2/i})).toBeDisabled();
    expect(screen.getByRole("radio",{name:"Manual"})).toHaveAttribute("aria-checked","false");
    const average=screen.getByRole("radio",{name:/Average/i});
    fireEvent.blur(screen.getByRole("spinbutton",{name:"Manual HP value"}),{relatedTarget:average});
    expect(mocks.update).toHaveBeenCalledOnce();
    fireEvent.click(average);
    await waitFor(()=>expect(screen.getByRole("button",{name:/Confirm level 2/i})).toBeEnabled());
    expect(mocks.update.mock.calls[1][1].choices.hp_rolls).toEqual({"fighter-2":{method:"average",value:6}});
  });

  it("shows pending controls and failed-save recovery inside the mobile level-up drawer", async () => {
    mocks.mobile=true;
    let rejectSave!:(error:Error)=>void;
    mocks.update.mockReturnValueOnce(new Promise<void>((_,reject)=>{rejectSave=reject}));
    const cls:ContentEntry={...human,id:"fighter",slug:"fighter",name:"Fighter",content_type:"class",data:{hit_die:10,levels:[{level:1,features:[]},{level:2,features:[]}]}};
    render(<ClassStepClient characterId="char-1" character={{...character,choices:{classes:[{slug:"fighter",level:1}]}}} classes={[cls]} subclasses={[]} features={[]} feats={[]} spells={[]} contentRefs={[]} schema={undefined}/>);
    fireEvent.click(screen.getByRole("button",{name:/Level up Fighter to level 2/i}));
    const drawer=within(screen.getByRole("dialog"));
    fireEvent.click(drawer.getByRole("radio",{name:/Average/i}));
    expect(drawer.getByRole("status",{name:""})).toHaveTextContent("Saving this class change");
    expect(drawer.getByRole("radio",{name:"Manual"})).toBeDisabled();
    expect(drawer.getByRole("button",{name:/Confirm level 2/i})).toBeDisabled();
    await act(async()=>rejectSave(new Error("private server detail")));
    expect(drawer.getByRole("alert")).toHaveTextContent("class change could not be confirmed");
    expect(drawer.getByRole("alert")).not.toHaveTextContent("private server detail");
    expect(drawer.getByRole("radio",{name:"Manual"})).toBeEnabled();
    expect(drawer.getByRole("button",{name:/Confirm level 2/i})).toBeDisabled();
    fireEvent.click(drawer.getByRole("radio",{name:/Average/i}));
    await waitFor(()=>expect(drawer.queryByRole("alert")).not.toBeInTheDocument());
    await waitFor(()=>expect(drawer.getByRole("button",{name:/Confirm level 2/i})).toBeEnabled());
    expect(mocks.update).toHaveBeenCalledTimes(2);
  });

  it("keeps mobile first-level choices disabled until save settlement and displays their errors", async () => {
    mocks.mobile=true;
    let rejectSave!:(error:Error)=>void;
    mocks.update.mockReturnValueOnce(new Promise<void>((_,reject)=>{rejectSave=reject}));
    const cls:ContentEntry={...human,id:"fighter",slug:"fighter",name:"Fighter",content_type:"class",data:{hit_die:10,levels:[{level:1,features:[]}]},effects:[{type:"choice",choose:1,from:["skill-athletics","skill-stealth"],grant_type:"proficiency",choice_id:"fighter-skill"}]};
    render(<ClassStepClient characterId="char-1" character={{...character,choices:{classes:[{slug:"fighter",level:1}]}}} classes={[cls]} subclasses={[]} features={[]} feats={[]} spells={[]} contentRefs={[]} schema={undefined}/>);
    fireEvent.click(screen.getByRole("button",{name:/^Level 1:/}));
    const drawer=within(screen.getByRole("dialog"));
    fireEvent.click(drawer.getByRole("button",{name:"Athletics"}));
    expect(drawer.getByRole("status")).toHaveTextContent("Saving this class change");
    expect(drawer.getByRole("button",{name:"Athletics"})).toBeDisabled();
    expect(drawer.getByRole("button",{name:"Stealth"})).toBeDisabled();
    await act(async()=>rejectSave(new Error("offline")));
    expect(drawer.getByRole("alert")).toHaveTextContent("class change could not be confirmed");
    expect(drawer.getByRole("button",{name:"Athletics"})).toHaveAttribute("aria-pressed","false");
    fireEvent.click(drawer.getByRole("button",{name:"Stealth"}));
    await waitFor(()=>expect(drawer.getByRole("button",{name:"Stealth"})).toBeEnabled());
    expect(mocks.update.mock.calls[1][1].choices.resolved_choices).toEqual({"fighter-skill":["skill-stealth"]});
  });

  it.each(["3.5","","0","11"])("rejects invalid manual HP %s with visible correction and no save", async (value) => {
    const cls:ContentEntry={...human,id:"fighter",slug:"fighter",name:"Fighter",content_type:"class",data:{hit_die:10,levels:[{level:1,features:[]},{level:2,features:[]}]}};
    render(<ClassStepClient characterId="char-1" character={{...character,choices:{classes:[{slug:"fighter",level:1}]}}} classes={[cls]} subclasses={[]} features={[]} feats={[]} spells={[]} contentRefs={[]} schema={undefined}/>);
    fireEvent.click(screen.getByRole("button",{name:/Level up Fighter to level 2/i}));
    fireEvent.click(screen.getByRole("radio",{name:"Manual"}));
    const input=screen.getByRole("spinbutton",{name:"Manual HP value"});
    fireEvent.change(input,{target:{value}});
    fireEvent.keyDown(input,{key:"Enter"});
    expect(mocks.update).not.toHaveBeenCalled();
    expect(input).toHaveAttribute("aria-invalid","true");
    expect(screen.getByRole("alert")).toHaveTextContent("whole number from 1 to 10");
    expect(screen.getByRole("button",{name:/Confirm level 2/i})).toBeDisabled();
    fireEvent.change(input,{target:{value:"4"}});
    fireEvent.keyDown(input,{key:"Enter"});
    await waitFor(()=>expect(screen.getByRole("button",{name:/Confirm level 2/i})).toBeEnabled());
    expect(input).not.toHaveAttribute("aria-invalid","true");
    expect(mocks.update.mock.calls[0][1].choices.hp_rolls).toEqual({"fighter-2":{method:"manual",value:4}});
  });

  it.each(["average_only","max_for_all"] as const)("allows deterministic %s HP without inventing a per-level record", async (hp_rule) => {
    const cls:ContentEntry={...human,id:"fighter",slug:"fighter",name:"Fighter",content_type:"class",data:{hit_die:10,levels:[{level:1,features:[]},{level:2,features:[]}]}};
    const hero={...character,choices:{classes:[{slug:"fighter",level:1}]},campaigns:{hp_rule}};
    mocks.canonical.mockResolvedValueOnce({choices:{classes:[{slug:"fighter",level:2}]},level:2});
    render(<ClassStepClient characterId="char-1" character={hero} classes={[cls]} subclasses={[]} features={[]} feats={[]} spells={[]} contentRefs={[]} schema={undefined}/>);
    fireEvent.click(screen.getByRole("button",{name:/Level up Fighter to level 2/i}));
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    const confirm=screen.getByRole("button",{name:/Confirm level 2/i});
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(()=>expect(mocks.canonical).toHaveBeenCalledOnce());
    expect(mocks.canonical.mock.calls[0][1]).toEqual({choices:{classes:[{slug:"fighter",level:2}]},level:2});
  });

  it.each([true,false])("preserves the selected pinned fighting style (newer catalog=%s)", (hasNewer) => {
    const parent:ContentEntry={...human,id:"fighting-style",slug:"fighting-style",name:"Fighting Style",content_type:"feature",data:{class:"fighter",feature_type:"fighting_style"}};
    const cls:ContentEntry={...human,id:"fighter",slug:"fighter",name:"Fighter",content_type:"class",data:{hit_die:10,levels:[{level:1,features:[parent.slug]}]}};
    const style:ContentEntry={...parent,id:"defense",slug:"defense",name:"Pinned Defense",data:{class:"fighter",feature_type:"fighting_style",description:"Authorized defense."}};
    const newer={...style,name:"Catalog Defense",version:2,data:{class:"wizard",feature_type:"fighting_style",description:"Changed defense."}};
    render(<ClassStepClient characterId="char-1" character={{...character,choices:{classes:[{slug:"fighter",level:1}],resolved_choices:{[parent.slug]:[style.slug]}}}} classes={[cls]} subclasses={[]} features={[parent,...(hasNewer?[newer]:[])]} feats={[]} spells={[]} contentRefs={[cls,parent,style].map(content=>({id:"pin-"+content.id,content_id:content.id,context:{},choice_source:null,content_definitions:content}))} schema={undefined}/>);
    expect(screen.getByRole("button",{name:/Pinned Defense/})).toHaveAttribute("aria-pressed","true");
    expect(screen.queryByText("Catalog Defense")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Choice made")).toBeVisible();
    fireEvent.click(screen.getByRole("button",{name:/Pinned Defense/}));
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("keeps the first style pin when selecting a separate fighting-style feature", async () => {
    const first:ContentEntry={...human,id:"first-style",slug:"first-style",name:"Fighting Style",content_type:"feature",data:{class:"fighter",feature_type:"fighting_style"}};
    const second={...first,id:"second-style",slug:"second-style"};
    const cls:ContentEntry={...human,id:"fighter",slug:"fighter",name:"Fighter",content_type:"class",data:{hit_die:10,levels:[{level:1,features:[first.slug]},{level:2,features:[second.slug]}]}};
    const defense={...first,id:"defense",slug:"defense",name:"Defense"};
    const archery={...first,id:"archery",slug:"archery",name:"Archery"};
    const refs=[cls,first,second,defense].map(content=>({id:"pin-"+content.id,content_id:content.id,context:content===defense?{source:"fighting_style",class:"fighter",feature:first.slug}:{},choice_source:null,content_definitions:content}));
    render(<ClassStepClient characterId="char-1" character={{...character,level:2,choices:{classes:[{slug:"fighter",level:2}],resolved_choices:{[first.slug]:[defense.slug]}}}} classes={[cls]} subclasses={[]} features={[first,second,defense,archery]} feats={[]} spells={[]} contentRefs={refs} schema={undefined}/>);
    fireEvent.click(screen.getByRole("button",{name:/Level 2/}));
    fireEvent.click(screen.getByRole("button",{name:/Archery/}));
    await waitFor(()=>expect(mocks.insert).toHaveBeenCalledOnce());
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.update.mock.calls[0][1].choices.resolved_choices).toEqual({[first.slug]:[defense.slug],[second.slug]:[archery.slug]});
  });

  it.each(["owned", "legacy", "shared-legacy"])("replaces only its own fighting-style reference (%s)", async (ownership) => {
    const parent:ContentEntry={...human,id:"fighting-style",slug:"fighting-style",name:"Fighting Style",content_type:"feature",data:{class:"fighter",feature_type:"fighting_style"}};
    const cls:ContentEntry={...human,id:"fighter",slug:"fighter",name:"Fighter",content_type:"class",data:{hit_die:10,levels:[{level:1,features:[parent.slug]}]}};
    const defense={...parent,id:"defense",slug:"defense",name:"Defense"};
    const archery={...parent,id:"archery",slug:"archery",name:"Archery"};
    const refs=[cls,parent,defense].map(content=>({id:"pin-"+content.id,content_id:content.id,context:content===defense?{source:"fighting_style",class:"fighter",...(ownership==="owned"?{feature:parent.slug}:{})}:{},choice_source:null,content_definitions:content}));
    const resolved_choices={[parent.slug]:[defense.slug],...(ownership==="shared-legacy"?{"another-choice":[defense.slug]}:{})};
    render(<ClassStepClient characterId="char-1" character={{...character,choices:{classes:[{slug:"fighter",level:1}],resolved_choices}}} classes={[cls]} subclasses={[]} features={[parent,defense,archery]} feats={[]} spells={[]} contentRefs={refs} schema={undefined}/>);
    fireEvent.click(screen.getByRole("button",{name:/Archery/}));
    await waitFor(()=>expect(mocks.insert).toHaveBeenCalledOnce());
    if(ownership==="shared-legacy") expect(mocks.remove).not.toHaveBeenCalled();
    else expect(mocks.remove).toHaveBeenCalledExactlyOnceWith("pin-defense");
    expect(mocks.insert).toHaveBeenCalledWith({characterId:"char-1",contentId:"archery",contentVersion:1,context:{source:"fighting_style",class:"fighter",feature:parent.slug}});
    expect(mocks.update.mock.calls[0][1].choices.resolved_choices).toEqual({...resolved_choices,[parent.slug]:[archery.slug]});
  });

  it("refuses conflicting saved fighting-style snapshots before editing", () => {
    const parent:ContentEntry={...human,id:"fighting-style",slug:"fighting-style",name:"Fighting Style",content_type:"feature",data:{class:"fighter",feature_type:"fighting_style"}};
    const cls:ContentEntry={...human,id:"fighter",slug:"fighter",name:"Fighter",content_type:"class",data:{hit_die:10,levels:[{level:1,features:[parent.slug]}]}};
    const style:ContentEntry={...parent,id:"defense",slug:"defense",name:"Pinned Defense"};
    const refs=[cls,parent,style,{...style,name:"Other Defense",version:2}].map((content,index)=>({id:"pin-"+index,content_id:content.id,context:{},choice_source:null,content_definitions:content}));
    render(<ClassStepClient characterId="char-1" character={{...character,choices:{classes:[{slug:"fighter",level:1}],resolved_choices:{[parent.slug]:[style.slug]}}}} classes={[cls]} subclasses={[]} features={[parent,style]} feats={[]} spells={[]} contentRefs={refs} schema={undefined}/>);
    expect(screen.getByRole("alert")).toHaveTextContent("Multiple saved snapshots");
    expect(screen.queryByRole("button",{name:/Pinned Defense/})).not.toBeInTheDocument();
    expect(screen.queryByText("Other Defense")).not.toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("blocks a second background subchoice while the first full-choice save is pending", async () => {
    let rejectSave!: (error: Error) => void;
    mocks.update.mockReturnValueOnce(new Promise<void>((_, reject) => { rejectSave = reject; }));
    const background: ContentEntry = { ...human, id: "soldier", name: "Soldier", slug: "soldier", content_type: "background", effects: [
      { type: "choice", choose: 1, from: ["skill-athletics"], grant_type: "proficiency", choice_id: "skill" },
      { type: "choice", choose: 1, from: ["tool-dice"], grant_type: "proficiency", choice_id: "tool" },
    ] };
    render(<BackgroundStepClient characterId="char-1" character={{ ...character, choices: { background: "soldier" } }} backgrounds={[background]} contentRefs={[{ id: "pin", content_id: background.id, context: {}, choice_source: null, content_definitions: background }]} schema={undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Athletics" }));
    expect(screen.getByRole("button", { name: "Tool Dice" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Tool Dice" }));
    expect(mocks.update).toHaveBeenCalledOnce();
    await act(async () => rejectSave(new Error("offline")));
    expect(screen.getByRole("button", { name: "Athletics" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "Tool Dice" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(2));
    expect(mocks.update.mock.calls[1][1].choices.resolved_choices).toEqual({ tool: ["tool-dice"] });
  });

});
