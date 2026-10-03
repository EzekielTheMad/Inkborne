export class CharacterStateReloadError extends Error {
  readonly requiresReload = true;
  constructor(message: string) { super(message); this.name = "CharacterStateReloadError"; }
}
