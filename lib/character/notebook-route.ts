/** The working character sheet, including its Narrative tab; builder/copy remain separate. */
export function isCharacterNotebookPath(pathname: string | null) {
  return /^\/characters\/[^/]+\/?$/.test(pathname ?? "") && !/^\/characters\/new\/?$/.test(pathname ?? "");
}

/** Pages migrated to the shared notebook brand frame. Keep other routes scoped out. */
export function isNotebookAppPath(pathname: string | null) {
  return /^\/(dashboard|characters)\/?$/.test(pathname ?? "") || isCharacterNotebookPath(pathname);
}
