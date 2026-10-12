import type { CharacterPrintModel, PrintEntry } from "@/lib/character/print-model";
import styles from "./character-print.module.css";

function Entries({ title, entries }: { title: string; entries: PrintEntry[] }) {
  return <section><h2>{title}</h2>{entries.length === 0 ? <p>None recorded.</p> : entries.map((entry, index) => <article key={index}>
    <h3>{entry.name}</h3><p className={styles.details}>{entry.details}</p>
    {entry.description ? <p className={styles.description}>{entry.description}</p> : null}
    <p className={styles.source}>Source: {entry.pin}</p>
  </article>)}</section>;
}

export function CharacterPrintView({ model }: { model: CharacterPrintModel }) {
  return <main className={styles.document} aria-label={`${model.name} printable character sheet`}>
    <header><p className={styles.brand}>INKBORNE · CHARACTER SHEET</p><h1>{model.name}</h1><p>{model.identity}</p>
      <p className={styles.source}>Snapshot: {model.capturedAt}. Captured loaded sheet values and saved content versions. Narrative and campaign notes excluded.</p></header>
    <section><h2>Abilities &amp; saving throws</h2><table><thead><tr><th>Ability</th><th>Score</th><th>Modifier</th><th>Save</th></tr></thead><tbody>{model.abilities.map(ability => <tr key={ability.name}><th scope="row">{ability.name}</th><td>{ability.score}</td><td>{ability.modifier}</td><td>{ability.save}</td></tr>)}</tbody></table></section>
    <section><h2>Combat, senses &amp; resources</h2><dl>{model.stats.map((stat, index) => <div key={index}><dt>{stat.name}</dt><dd>{stat.value}</dd></div>)}</dl></section>
    <section><h2>Skills</h2><table><thead><tr><th>Skill</th><th>Modifier</th><th>Passive</th></tr></thead><tbody>{model.skills.map(skill => <tr key={skill.name}><th scope="row">{skill.name}</th><td>{skill.modifier}</td><td>{skill.passive}</td></tr>)}</tbody></table></section>
    <section><h2>Proficiencies &amp; expertise</h2><p>{model.proficiencies.join("; ") || "None recorded."}</p></section>
    <Entries title="Attacks" entries={model.attacks} />
    <Entries title="Inventory" entries={model.inventory} />
    <Entries title="Spells" entries={model.spells} />
    <Entries title="Features & content" entries={model.features} />
  </main>;
}
