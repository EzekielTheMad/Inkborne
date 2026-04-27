# Class Preview Modal (Variant B) — design spec

**Date:** 2026-04-27
**Status:** Design approved, ready for implementation plan
**Slice:** PR-A of the Builder UX Polish phase (M2). Class-only first; race + background follow as later PRs.

Source design bundle: [`docs/design-briefs/builder-ux-polish-design-files/`](../../design-briefs/builder-ux-polish-design-files/) (Variant B in `preview-variants.jsx`, screenshot `01-preview-modal-recommended.png`).

---

## Goal

Replace the existing class preview dialog (`components/builder/content-preview.tsx`) with the design team's Variant B layout: class identity strip + 4 tabs (Overview / Features / Subclasses / Spells) + Preview-as-level dropdown + sticky footer. The modal opens when a player taps a class card in the picker and closes on Cancel or Pick.

## Non-goals

- **Race and background previews.** They keep the existing `content-preview.tsx` until their own PRs (PR-A doesn't touch them).
- **Mobile-specific bottom-sheet treatment.** That's PR-E (Mobile breakpoint). At sub-`md`, the modal renders as a default fullscreen-ish dialog — acceptable until PR-E.
- **Class Step rail / multiclass / level-up flow.** All later PRs in M2.
- **Character primary color** (the player-pickable color from PR-F). The class emblem uses class color (gold/purple) only.
- **Backend / data model changes.** Class data already supports per-level features; subclasses + spells live in `content_definitions` with the same query patterns the sheet already uses.

## File layout

**New files:**
- `components/builder/class-preview-modal.tsx` — the modal component.
- `components/builder/class-emblem.tsx` — the rounded-rect emblem with the Georgia letter (used here and reused later in the Class Step rail). Takes `class` slug + `size` (`sm`/`md`/`lg`).
- `lib/builder/class-tone.ts` — slug→tone mapping (`gold` for non-casters, `purple` for casters). Two tones for v1 per design.
- `tests/components/builder/class-preview-modal.test.tsx` — vitest + testing-library coverage.

**Modified files:**
- `app/(app)/characters/[id]/builder/class/class-step-client.tsx` — replace its `<ContentPreview>` render with the new `<ClassPreviewModal>`. This is the only call site we change in PR-A.

**Untouched:**
- `components/builder/content-preview.tsx` — still used by race + background.
- `app/(app)/characters/[id]/builder/race/race-step-client.tsx` and `.../background/background-step-client.tsx` — both keep rendering the old `<ContentPreview>` until their own polish PRs land.
- `components/builder/content-browser.tsx` — the picker grid below the modal is unchanged.

## Component shape

```
<ClassPreviewModal />
├── <Dialog open onOpenChange>                        — shadcn Dialog primitive
│   └── DialogContent (1120×820 max, rounded-xl, shadow-2xl)
│       ├── <CloseButton aria-label="Close" />        — X in 40px header bar
│       ├── <ClassIdentityStrip>                       — 56×56 emblem + name + meta
│       ├── <Tabs.Root value/onChange>
│       │   ├── <Tabs.List>                            — 4 pill tabs (Spells only if caster)
│       │   └── <Tabs.Body>
│       │       ├── <OverviewTab />                    — prose + ability chips + role tags
│       │       ├── <FeaturesTab level={previewLevel} subclassSlug={previewSubclassSlug}/>
│       │       ├── <SubclassesTab onSelect={setPreviewSubclassSlug}/>
│       │       └── <SpellsTab classSlug={...}/>       — caster-only; filter chips + list
│       └── <ModalFooter>
│           ├── <PreviewLevelDropdown value/onChange/> — 1..maxLevel
│           ├── <Button variant="outline">Cancel</Button>
│           └── <Button variant="accent">Pick this class</Button>
```

### Building blocks

- **`<ClassEmblem>`** — rounded rect with Georgia letter at 32px (large) / smaller scales for medium/small. Background and border tones come from `class-tone.ts`. Letter is `aria-hidden`.
- **Tabs** — use the shadcn/Radix-pattern tabs primitive if present; otherwise `@base-ui/react/tabs` (consistent with the popover used elsewhere). Confirm during implementation.
- **`<SubclassesTab>`** — grid of subclass cards. Tapping a card sets `previewSubclassSlug` in modal-local state. Doesn't persist until Pick.
- **`<SpellsTab>`** — only mounted if class is a caster. Filter chips (level, school) + scrollable list. Read-only.
- **`<PreviewLevelDropdown>`** — `<select>` styled to match. Range `1..maxLevel` from class data. Default `1`. Affects the Features tab and the subclass-feature filter.

### Subclass timing

The Features tab renders features grouped by level. Subclass-locked features have `data.subclass = <slug>` — filter by `previewSubclassSlug` (and hide if no subclass picked). This sidesteps the README's "subclass timing" concern: features are tagged at the data layer, not by hardcoding "subclass picks at Lv 3 for Paladin."

## Data flow & state

```ts
interface ClassPreviewModalProps {
  open: boolean;
  classContent: ContentEntry | null;
  features: ContentEntry[];                     // class features pre-loaded by parent
  subclasses: ContentEntry[];                   // subclasses for this class, pre-loaded by parent
  spells: ContentEntry[];                       // class-eligible spells (only meaningful if caster)
  onCancel: () => void;
  onPick: (selection: { classSlug: string; subclassSlug: string | null }) => void;
}
```

The parent loads `subclasses` and `spells` via the same Supabase query patterns the sheet already uses (`content_type = 'subclass' AND data->>class = <slug>` and `content_type = 'spell' AND <class-eligibility>`). The modal stays a pure render component (no Supabase calls inside), matching how `ContentPreview` already takes `features` as a prop.

**Modal-local state:**
```ts
const [activeTab, setActiveTab] = useState<"overview" | "features" | "subclasses" | "spells">("overview");
const [previewLevel, setPreviewLevel] = useState<number>(1);
const [previewSubclassSlug, setPreviewSubclassSlug] = useState<string | null>(null);
const [spellLevelFilter, setSpellLevelFilter] = useState<number | "all">("all");
const [spellSchoolFilter, setSpellSchoolFilter] = useState<string | "all">("all");
```

**Reset on open:** when `open` transitions `false → true` for a new class, all five states reset to defaults. `useEffect([open, classContent?.id])`.

**Derived values:**
```ts
const isCaster = !!(classContent?.data.spellcasting || classContent?.data.spellsKnown);
const maxLevel = (classContent?.data.levels as Array<{level: number}>)?.length ?? 20;
const visibleTabs = isCaster
  ? ["overview", "features", "subclasses", "spells"]
  : ["overview", "features", "subclasses"];
```

**Pick flow:**
1. User clicks **Pick this class** → `onPick({ classSlug: classContent.slug, subclassSlug: previewSubclassSlug })`.
2. Parent persists the class + (optionally) subclass via the existing `createCharacter` / `updateCharacter` plumbing.

**Cancel flow:** `onCancel()`. No state change, no toast.

**Empty data states:** if `subclasses` or `spells` arrays are empty when the tab is opened, the tab renders an empty-state message (`"No subclasses found"`). No spinners — modal open is synchronous on user click; data should already be loaded by the time the user can click.

## Interactions, animations, a11y

| Trigger | Spec | Implementation |
|---|---|---|
| Modal open | 180ms fade + scale-from-95% | Tailwind `data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:duration-[180ms]`. Easing `cubic-bezier(0.16, 1, 0.3, 1)` via arbitrary value. |
| Tab body switch | 120ms cross-fade | Key-swap each tab body div with a 120ms opacity transition; same easing. |
| Preview level change | Instant | No animation; re-render Features tab synchronously. |
| Subclass card pick | Instant + visual highlight on selected card | `data-selected` styling. |

**Focus trap & keyboard:**
- shadcn Dialog handles the focus trap.
- **Cancel button is the first focusable element** on open (`autoFocus` or focus-on-mount effect) so a stray Enter doesn't auto-pick.
- Escape closes the modal (same as Cancel) — handled by Dialog primitive.
- Tabs support Left/Right (cycle), Home/End (jump) via the chosen tabs primitive's built-in keyboard handling.

**ARIA:**
- `aria-labelledby` on DialogContent points at the class name `<h2>` in the identity strip.
- Class emblem letter is `aria-hidden`.
- Filter chips in the Spells tab are `<button aria-pressed={selected}>`.
- Preview-level dropdown: native `<select>` with `aria-label="Preview level"`.

**Visual specifics from the brief:**
- Identity strip padding `16px 24px`, no fill.
- Active tab: `bg-accent/12 text-accent border-accent/40`. Inactive: `text-muted-foreground bg-transparent`. Border-bottom on the row.
- Footer: sticky bottom, padding `12px 16px`, top border `1px`. Level dropdown left, buttons right.
- Modal artboard: `1120 × 820` desktop. `max-w-[1120px] max-h-[820px] w-[min(1120px,90vw)] h-[min(820px,85vh)]`.
- Border radius `12px` on the modal.
- Lift shadow: `0 24px 60px rgba(0,0,0,0.5)` (custom — Tailwind's `shadow-2xl` is a near match; we'll arbitrary-value the exact spec).

## Tests

vitest + testing-library, against the new component:

1. Renders class identity strip with name + meta line.
2. Tab switching via click + keyboard (Left/Right/Home/End).
3. `previewLevel` dropdown change filters Features tab to features with level ≤ N.
4. Subclass pick highlights the selected card and surfaces subclass-gated features in the Features tab.
5. Spells tab only renders for caster classes; filter chips work; row count updates as filters change.
6. Cancel calls `onCancel`, never `onPick`.
7. Pick calls `onPick({ classSlug, subclassSlug })` reflecting modal-local selection.
8. Reopening modal with a different class resets all internal state.

The shadcn `Dialog` portal mounts to `document.body`; tests use `findBy*` queries to wait for portal mount (same pattern as `tests/components/sheet/hp-tracker.test.tsx`).

## Open questions resolved by this design

From the design bundle README:

| Q | Resolution |
|---|---|
| Per-level snapshot vs. derived state | Modal renders by-level features without writing per-level state. Persistence concerns are PR-B (Class Step). Not a blocker here. |
| Subclass timing across classes | Features data is already tagged with `data.subclass`. The Features tab filters by `previewSubclassSlug`. No hardcoded "subclass-at-level-X" lookup needed. |
| Removing levels | Out of scope for the modal. PR-B (Class Step) handles level shrinking. |

## Out of scope / follow-ups

| Item | Why deferred |
|---|---|
| Race + background previews using the new pattern | Separate PRs in M2 once the class pattern is shipped and stable. |
| Mobile bottom-sheet variant | PR-E in the slice plan. |
| "Picked Paladin" confirmation toast | Mentioned in the brief but the parent owns post-pick UX. Add when integrating, not as a modal feature. |
| Spells tab interactivity (sorting, search box) | Brief specifies filter chips only. If alpha testers ask for search, follow-up PR. |
| Animation polish beyond the brief's two timings | Stick to the brief; no extra movement. |

## Implementation references

- Source design: [`docs/design-briefs/builder-ux-polish-design-files/`](../../design-briefs/builder-ux-polish-design-files/)
- Existing modal: [`components/builder/content-preview.tsx`](../../../components/builder/content-preview.tsx)
- Picker grid: [`components/builder/content-browser.tsx`](../../../components/builder/content-browser.tsx)
- Sheet uses similar subclass + spell queries: `app/(app)/characters/[id]/page.tsx`
- Token system / class colors: `app/globals.css` + `tailwind.config.*`
