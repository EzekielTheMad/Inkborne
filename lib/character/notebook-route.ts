/** The working character sheet, including its Narrative tab; builder/copy remain separate. */
export function isCharacterNotebookPath(pathname: string | null) {
  return /^\/characters\/[^/]+\/?$/.test(pathname ?? "") && pathname !== "/characters/new";
}
