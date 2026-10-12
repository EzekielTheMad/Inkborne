import type { NpcData } from "@/lib/schemas/content-types/npc";

const listFields = [
  ["personality_traits", "Personality traits"], ["ideals", "Ideals"],
  ["bonds", "Bonds"], ["flaws", "Flaws"],
] as const;
const textFields = [["motivation", "Motivation"], ["mannerisms", "Mannerisms"], ["fear", "Fear"]] as const;

/** Already validated narrative data. No lookup, effects, private state or HTML. */
export function NpcProfile({ data }: { data: NpcData }) {
  return <section className="min-w-0 space-y-8 [overflow-wrap:anywhere]" aria-label="NPC profile">
    {listFields.map(([key, label]) => {
      const values = data.personality?.[key];
      return values?.length ? <section key={key} aria-label={label}>
        <h2 className="j-folio">{label}</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7">
          {values.map((value, index) => <li key={index} className="whitespace-pre-line">{value}</li>)}
        </ul>
      </section> : null;
    })}
    {textFields.map(([key, label]) => {
      const value = data.personality?.[key];
      return value === undefined ? null : <section key={key} aria-label={label}>
        <h2 className="j-folio">{label}</h2>
        <p className="mt-3 whitespace-pre-line text-sm leading-7">{value}</p>
      </section>;
    })}
    {data.relationships?.length ? <section aria-label="Template relationship ideas">
      <h2 className="j-folio">Template relationship ideas</h2>
      <p className="mt-2 text-sm text-muted-foreground">Story hooks for your table. These do not create or link character relationships.</p>
      <ul className="mt-4 space-y-5">
        {data.relationships.map((idea, index) => <li key={index}>
          <h3 className="font-medium">{idea.name}</h3>
          <p className="mt-1 whitespace-pre-line text-sm leading-7">{idea.relationship}</p>
          {idea.description === undefined ? null : <p className="mt-2 whitespace-pre-line text-sm leading-7">{idea.description}</p>}
        </li>)}
      </ul>
    </section> : null}
    <p className="text-sm text-muted-foreground">Narrative template only. No gameplay statistics or campaign secrets are included.</p>
  </section>;
}
