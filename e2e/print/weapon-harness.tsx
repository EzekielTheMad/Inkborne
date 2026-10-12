import { createRoot } from "react-dom/client";
import { ActionsTab } from "@/components/sheet/tabs/actions-tab";
import { CharacterPrintAction } from "@/components/sheet/character-print-action";
import { canonicalWeaponPrintFixture } from "./canonical-weapons";
const ctx = canonicalWeaponPrintFixture();
createRoot(document.getElementById("root")!).render(<>
  <h1>Canonical weapon UI fixture</h1>
  <ActionsTab character={ctx.character} schema={ctx.schema} evalResult={ctx.evalResult} contentRefs={ctx.contentRefs} />
  <CharacterPrintAction />
</>);
