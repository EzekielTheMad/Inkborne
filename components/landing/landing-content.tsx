import Image from "next/image";
import Link from "next/link";
import { HomepageAppearance } from "@/components/landing/homepage-appearance";
import { NotebookExperience } from "@/components/landing/notebook-experience";
import styles from "./landing-content.module.css";

/** Public notebook presentation. Authentication stays in the page's server gate. */
export function LandingContent() {
  return (
    <div className={styles.root} data-testid="homepage">
      <a className={styles.skipLink} href="#home-main">Skip to main content</a>

      <div className={styles.alphaBanner}>
        <p>
          <span aria-hidden="true">✦</span> <strong>Private alpha</strong>
          <span className={styles.alphaDetail}> · Still taking shape. Expect rough edges.</span>
        </p>
      </div>

      <header className={styles.siteHeader}>
        <div className={`${styles.headerInner} ${styles.container}`}>
          <BrandLockup />
          <nav className={styles.siteNav} aria-label="Main navigation">
            <a href="#features">Features</a>
            <a href="#open-source">Open source</a>
          </nav>
          <div className={styles.headerActions}>
            <HomepageAppearance className={styles.appearanceControl} />
            <Link className={styles.headerSignIn} href="/login">Sign in</Link>
          </div>
        </div>
      </header>

      <main id="home-main">
        <NotebookExperience character={<SheetExample />} journal={<JournalExample />} homebrew={<HomebrewExample />} />

        <section className={styles.openSource} id="open-source" aria-labelledby="home-source-title">
          <div className={`${styles.openSourceInner} ${styles.container}`}>
            <div className={styles.sourceMark} aria-hidden="true">
              <svg viewBox="0 0 320 512" fill="currentColor">
                <path fillRule="evenodd" d="M160 0 C165 0 167 11 170 21 C192 106 236 180 316 258 Q321 263 316 269 C274 319 225 404 225 449 C225 470 233 483 248 494 Q251 496 251 500 V509 Q251 512 247 512 H73 Q69 512 69 509 V500 Q69 496 72 494 C87 483 95 470 95 449 C95 404 46 319 4 269 Q-1 263 4 258 C84 180 128 106 150 21 C153 11 155 0 160 0 Z M160 36 C162 36 163 39 163 43 L170 161 C171 174 174 182 187 182 H222 Q224 182 224 185 V196 Q224 199 221 199 C194 200 187 206 187 232 V454 C187 478 194 484 222 485 Q224 485 224 488 V498 Q224 500 222 500 H98 Q96 500 96 498 V488 Q96 485 98 485 C126 484 133 478 133 454 V232 C133 206 126 200 99 199 Q96 199 96 196 V185 Q96 182 98 182 H133 C146 182 149 174 150 161 L157 43 C157 39 158 36 160 36 Z" />
              </svg>
            </div>
            <div>
              <p className={styles.folio}>IV · Written in the open</p>
              <h2 id="home-source-title">A place for your story.<br /><em>A say in what comes next.</em></h2>
              <p>
                Inkborne is open source. A character tool should invite the same
                curiosity and creativity as the games it serves: room to understand
                it, question it, and help it grow.
              </p>
              <div className={styles.sourceValues}>
                <span><b aria-hidden="true">✦</b> Open source</span>
                <span><b aria-hidden="true">✦</b> Room for homebrew</span>
                <span><b aria-hidden="true">✦</b> Made for the table</span>
              </div>
            </div>
          </div>
        </section>

        <section className={`${styles.closing} ${styles.container}`} aria-labelledby="home-closing-title">
          <div className={styles.starRule} aria-hidden="true"><span /><b>✦</b><span /></div>
          <p className={styles.folio}>A new page</p>
          <h2 id="home-closing-title">Begin a character.</h2>
          <p>One name. A few choices. A story waiting to happen.</p>
          <Link className={styles.button} href="/signup">Start building</Link>
          <p className={styles.closingAlpha}>Private alpha · Still taking shape.</p>
        </section>
      </main>

      <footer className={styles.siteFooter}>
        <div className={`${styles.footerInner} ${styles.container}`}>
          <BrandLockup footer />
          <p>Character sheets and character stories, kept together.</p>
          <div className={styles.footerLinks}>
            <a href="https://discord.gg/inkborne" target="_blank" rel="noopener noreferrer">Discord</a>
            <a href="https://github.com/inkborne" target="_blank" rel="noopener noreferrer">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function BrandLockup({ footer = false }: { footer?: boolean }) {
  const sizeClass = footer ? styles.footerLogo : styles.brandLogo;

  return (
    <Link className={styles.brandLink} href="/" aria-label="Inkborne home">
      <Image className={`${sizeClass} ${styles.logoLight}`} data-logo-theme="light"
        src="/brand/inkborne-horizontal-ink.svg" width={407} height={96} alt="Inkborne" unoptimized />
      <Image className={`${sizeClass} ${styles.logoDark}`} data-logo-theme="dark"
        src="/brand/inkborne-horizontal-reverse.svg" width={407} height={96} alt="Inkborne" unoptimized />
    </Link>
  );
}

function SheetExample() {
  const saves = [
    { name: "STR", value: "−1" },
    { name: "DEX", value: "+2" },
    { name: "CON", value: "+1" },
    { name: "INT", value: "+7", proficient: true },
    { name: "WIS", value: "+4", proficient: true },
    { name: "CHA", value: "+0" },
  ];

  return (
    <figure className={styles.exampleFigure}>
      <div className={styles.notebookCard}>
        <div className={styles.sheetHeading}>
          <div>
            <p className={styles.smallLabel}>Character record</p>
            <h3>Thalindra Voss</h3>
            <p className={styles.characterSubtitle}>High elf wizard <span aria-hidden="true">·</span> Level 5</p>
          </div>
          <span className={styles.identitySeal} aria-hidden="true">T</span>
        </div>
        <div className={styles.sheetSectionHeading}>
          <h4>Saving throws</h4>
          <span className={styles.proficiencyKey}><span aria-hidden="true">●</span> Proficient</span>
        </div>
        <dl className={styles.saveGrid}>
          {saves.map(({ name, value, proficient }) => (
            <div key={name} className={proficient ? styles.proficient : undefined}>
              <dt>{name}</dt>
              <dd>{proficient && <><span aria-hidden="true">●</span><span className="sr-only">Proficient: </span>{" "}</>}{value}</dd>
            </div>
          ))}
        </dl>
        <div className={styles.sheetSectionHeading}><h4>Defenses &amp; movement</h4></div>
        <dl className={styles.defenseGrid}>
          <div><dt>Armor class</dt><dd>17</dd></div>
          <div><dt>Initiative</dt><dd>+2</dd></div>
          <div><dt>Speed</dt><dd>30 <span>ft</span></dd></div>
        </dl>
        <div className={styles.sheetFoot}>
          <span className={styles.spellPips} aria-hidden="true"><i /><i /><i /><i className={styles.spent} /></span>
          <span>1st-level spell slots <strong>3 / 4</strong></span>
        </div>
      </div>
      <figcaption>Fictional character · Illustrative sheet layout</figcaption>
    </figure>
  );
}

function JournalExample() {
  return (
    <figure className={styles.exampleFigure}>
      <div className={`${styles.notebookCard} ${styles.journalCard}`}>
        <div className={styles.journalDateline}>
          <p className={styles.folio}>Session XII</p>
          <p className={styles.moonNote}>Last waxing crescent</p>
        </div>
        <h3>The Tolling at Shadepoint</h3>
        <p className={styles.journalProse}>
          <span className={styles.dropCap}>W</span>e arrived past second bell. The
          keeper would not look us in the eye, and yet he had set out three cups.
          Thalindra marked the page with iron filings — proof of recent abjuration
          — and slipped the keeper a coin he did not want to take.
        </p>
        <div className={styles.journalRule} aria-hidden="true"><span /><b>✦</b><span /></div>
        <p className={styles.journalAfterthought}>Next time: ask whose name is missing from the bell.</p>
        <div className={styles.storyTags} aria-label="Example journal details">
          <span>The keeper</span><span className={styles.violetTag}>Unanswered question</span><span>Iron filings</span>
        </div>
        <div className={styles.journalPageNumber} aria-hidden="true">— 24 —</div>
      </div>
      <figcaption>Fictional journal excerpt · Illustrative notebook layout</figcaption>
    </figure>
  );
}

function HomebrewExample() {
  return (
    <figure className={styles.exampleFigure}>
      <div className={`${styles.notebookCard} ${styles.homebrewCard}`}>
        <div className={styles.homebrewTopline}>
          <p className={styles.folio}>From the homebrew library</p>
          <span className={styles.homebrewStamp}>Spell</span>
        </div>
        <p className={styles.covenName}>Coven of Greyfen</p>
        <h3>Lantern of the Lost</h3>
        <p className={styles.spellSchool}>1st-level divination · A fictional homebrew spell</p>
        <dl className={styles.spellDetails}>
          <div><dt>Casting time</dt><dd>1 action</dd></div>
          <div><dt>Range</dt><dd>30 feet</dd></div>
          <div><dt>Duration</dt><dd>10 minutes</dd></div>
          <div><dt>Components</dt><dd>V, S, M</dd></div>
        </dl>
        <p className={styles.spellDescription}>
          A pale lantern kindles above your open palm. Its light bends toward a
          familiar trail, even where the fen has swallowed every footprint.
        </p>
        <div className={styles.homebrewMargin}>
          <span aria-hidden="true">✦</span>
          <p>A moth&rsquo;s wing, freely given.<br /><em>Remember: the light knows the way, not the danger.</em></p>
        </div>
      </div>
      <figcaption>Fictional homebrew · An example of flavor and rules together</figcaption>
    </figure>
  );
}
