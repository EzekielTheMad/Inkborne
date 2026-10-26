"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useTheme } from "@/components/theme-provider";
import { notebookAccentStyle } from "@/lib/landing/notebook-accent";
import shared from "./landing-content.module.css";
import styles from "./notebook-experience.module.css";

const chapters = [
  { id: "character", name: "Character", folio: "I", title: "Ready for the next turn.", description: "Ability scores, saving throws, equipment, and the choices that made this character yours. The useful details, close at hand." },
  { id: "journal", name: "Journal", folio: "II", title: "Remember what the dice started.", description: "The keeper with a secret. A promise still unkept. Keep the threads of your campaign beside the character living it." },
  { id: "homebrew", name: "Homebrew", folio: "III", title: "Something from your own world.", description: "A spell from the fen, a feat earned on the road, a background with a story. Make room for your table’s ideas." },
] as const;
const accents = [
  { name: "Site gold", color: null },
  { name: "Purple", color: "#7c3aed" },
  { name: "Emerald", color: "#059669" },
  { name: "Crimson", color: "#b91c1c" },
  { name: "Blue", color: "#2563eb" },
] as const;

type Chapter = typeof chapters[number]["id"];

/** An illustrative, page-local notebook. No account requests or character writes. */
export function NotebookExperience({ character, journal, homebrew }: {
  character: ReactNode; journal: ReactNode; homebrew: ReactNode;
}) {
  const { resolvedTheme } = useTheme();
  const [active, setActive] = useState<Chapter>("character");
  const [accent, setAccent] = useState<string | null>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const chapter = chapters.find((item) => item.id === active)!;
  const selection = accents.find((item) => item.color === accent)?.name ?? "Custom";
  const pages = { character, journal, homebrew };

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % chapters.length;
    else if (event.key === "ArrowLeft") next = (index + chapters.length - 1) % chapters.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = chapters.length - 1;
    else return;
    event.preventDefault();
    setActive(chapters[next].id);
    tabs.current[next]?.focus();
  }

  return (
    <div className={styles.experience} style={notebookAccentStyle(accent)}>
      <section className={`${styles.hero} ${shared.container}`} aria-labelledby="home-title">
        <div className={styles.heroCopy}>
          <p className={shared.folio}>The sheet · The story · One place</p>
          <h1 id="home-title">Your character sheet<br />and your <em>character&rsquo;s story</em>,<br />in the same notebook.</h1>
          <p className={styles.introduction}>The numbers that get you through a fight. The notes that bring you back to the story. Keep both close, from the first character choice to the next session.</p>
          <div className={styles.heroActions}>
            <Link className={shared.button} href="/signup">Start building</Link>
            <a className={`${shared.button} ${shared.buttonOutline}`} href="#features">Open the notebook <span aria-hidden="true">↗</span></a>
          </div>
          <p className={styles.heroFootnote}>A place for the character. Room for the person playing them.</p>
        </div>
        <figure className={styles.heroScene}>
          <div className={styles.illustration}>
            <Image src="/illustrations/thalindra-shadepoint.webp" alt="An ink illustration of Thalindra holding a lantern among the reeds of Shadepoint." width={900} height={1200} sizes="(max-width: 600px) 74vw, 400px" preload />
          </div>
          <div className={styles.heroLeaf}>
            <span className={styles.ribbon} aria-hidden="true" />
            <p className={styles.smallLabel}>Character record · 05</p>
            <p className={styles.heroName}>Thalindra Voss</p>
            <p className={styles.heroCharacter}>High elf wizard · Level 5</p>
            <dl className={styles.heroStats}>
              <div><dt>Armor class</dt><dd>17</dd></div>
              <div><dt>Initiative</dt><dd>+2</dd></div>
              <div><dt>Speed</dt><dd>30 <small>ft</small></dd></div>
            </dl>
          </div>
          <div className={styles.looseNote}>
            <p>Session XII · Shadepoint</p>
            <blockquote>“The keeper had set out three cups.<br />We had told no one we were coming.”</blockquote>
            <span aria-hidden="true">— T.V.</span>
          </div>
          <figcaption>Fictional character &amp; campaign · An illustrative notebook</figcaption>
        </figure>
      </section>

      <section className={`${styles.explore} ${shared.container}`} id="features" aria-label="Explore Thalindra’s notebook">
        <div className={styles.exploreHeading}>
          <div><p className={shared.folio}>Inside the notebook</p><h2>A sheet. A story. <em>Entirely yours.</em></h2></div>
          <p>Meet Thalindra. Follow a thread.<br />Leave your own mark in the margins.</p>
        </div>

        <div className={styles.bookmarks} role="tablist" aria-label="Notebook chapters">
          {chapters.map((item, index) => (
            <button key={item.id} ref={(element) => { tabs.current[index] = element; }} type="button" role="tab" id={`notebook-tab-${item.id}`} aria-controls={`notebook-panel-${item.id}`} aria-selected={active === item.id} tabIndex={active === item.id ? 0 : -1} onClick={() => setActive(item.id)} onKeyDown={(event) => onTabKey(event, index)}>
              <span aria-hidden="true">{item.folio}</span> {item.name}
            </button>
          ))}
        </div>

        <div className={styles.openBook}>
          <aside className={styles.contents}>
            <p className={styles.smallLabel}>From the notebook of</p>
            <div className={styles.identity}>
              <p className={styles.owner}>Thalindra<br /> Voss<span aria-hidden="true">.</span></p>
              <div className={styles.portrait} aria-hidden="true"><Image src="/illustrations/thalindra-shadepoint.webp" alt="" width={900} height={1200} sizes="180px" /></div>
            </div>
            <p className={styles.contentsCaption}>Wizard. Reluctant investigator.<br />A little too curious for her own good.</p>
            <div className={styles.chapterNote}><span aria-hidden="true">{chapter.folio}.</span><div><h3>{chapter.title}</h3><p>{chapter.description}</p></div></div>
            <p className={styles.fictionNote}>A fictional example. Explore freely.</p>
          </aside>
          <div className={styles.pageStack}>
            {chapters.map((item) => (
              <div key={item.id} role="tabpanel" id={`notebook-panel-${item.id}`} aria-labelledby={`notebook-tab-${item.id}`} hidden={active !== item.id} tabIndex={0} className={styles.page}>
                {pages[item.id]}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.personalize}>
          <div><p className={styles.personalizeTitle}>Make the margin yours.</p><p className={styles.personalizeHint}>Try a character accent. It follows the notebook through light and dark.</p></div>
          <fieldset className={styles.accentChoices}>
            <legend className="sr-only">Example character accent</legend>
            {accents.map((item) => (
              <label key={item.name} title={item.name} className={styles.swatchLabel}>
                <input type="radio" name="notebook-accent" value={item.color ?? "site"} checked={accent === item.color} onChange={() => setAccent(item.color)} aria-label={item.name} />
                <span style={{ background: item.color ?? "var(--action)" }} aria-hidden="true">{accent === item.color ? "✓" : ""}</span>
              </label>
            ))}
            <label className={styles.customColor}>Custom<input aria-label="Custom accent" type="color" value={accent ?? (resolvedTheme === "dark" ? "#c9a44a" : "#785923")} onChange={(event) => setAccent(event.target.value)} /></label>
          </fieldset>
          <div className={styles.accentStatus}><p aria-live="polite">{selection === "Site gold" ? "Site accent · follows appearance" : `${selection} accent`}</p><button type="button" onClick={() => setAccent(null)}>Use site accent</button></div>
        </div>
        <p className={styles.previewNote}>Illustrative layouts with fictional content. Accent changes apply to this example only.</p>
      </section>
    </div>
  );
}
