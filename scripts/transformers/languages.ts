import { fetchAllFromApi, buildContentEntry } from "./common";
import type { TransformedContent } from "./common";

interface ApiLanguage {
  index: string;
  name: string;
  desc: string;
  type: string;
  script: string | null;
  typical_speakers: string[];
}

export async function transformLanguages(): Promise<TransformedContent[]> {
  const languages = await fetchAllFromApi<ApiLanguage>("/languages");
  return languages.map((lang) =>
    buildContentEntry("language", lang.index, lang.name, {
      type: lang.type,
      script: lang.script ?? null,
      typical_speakers: lang.typical_speakers,
      description: lang.desc ?? "",
    })
  );
}
