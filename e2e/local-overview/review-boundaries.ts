/** Fictional, loopback-only data. Never imported by a Next route. */
import type { Character } from '@/lib/types/character';

type Row = Record<string, unknown>;
export type ReviewCharacter = Character & { game_systems: { name: string }; campaigns: { name: string } | null };
const names = [
  ['Mara Stonepath', null, 'fighter', 'human', 5],
  ['Iven Lanternkeeper', '#227A58', 'wizard', 'elf', 5],
  ['Rook of Greyfen', '#7843BE', 'rogue', 'halfling', 3],
  ['Aster Winterglass', '#FFFFFF', 'cleric', 'human', 4],
  ['Bram Blackthorn', '#000000', 'ranger', 'half-elf', 6],
  ['Alexandria Amberweather of the Seven Lanterns and the Far Northern Road', '#D6AA24', 'bard', 'half-elf', 7],
  ['A name in the margin', null, '', '', 1],
  ['Sable Reed', '#2563EB', 'druid', 'dwarf', 2],
] as const;
export const fixtureCharacters: ReviewCharacter[] = names.map(([name, primary_color, slug, race, level], index) => ({
  id: `11111111-1111-4111-8111-${String(index + 1).padStart(12, '0')}`,
  user_id: 'local-overview-reviewer', system_id: 'local-system', campaign_id: index === 0 || index === 2 ? 'local-campaign' : null,
  name, primary_color, level, visibility: 'private', archived: false, base_stats: {},
  choices: slug ? { classes: [{ slug, level }], race } : {}, state: {}, narrative: {}, narrative_rich: {},
  created_at: `2026-10-${String(24 - index).padStart(2, '0')}T12:00:00Z`,
  game_systems: { name: index === 5 ? 'A fictional game system with a deliberately long display name' : 'D&D 5e 2014' },
  campaigns: index === 0 || index === 2 ? { name: 'Lanterns of Bellmere' } : index === 5 ? { name: 'The Chronicle of the Long Road Beyond the Seven Lanterns' } : null,
}));

interface OverviewReview {
  operations: Array<{ table: string; select: string; filters: unknown[]; limit: number | null }>;
  blocked: string[];
  scenario: string;
  createClient: () => unknown;
  dismissAlpha: () => Promise<{ success: true }>;
}
declare global { interface Window { overviewReview: OverviewReview } }

function columns(raw: string) {
  let depth = 0, part = ''; const result: string[] = [];
  for (const char of raw) { if (char === '(') depth++; if (char === ')') depth--; if (char === ',' && depth === 0) { result.push(part.trim()); part = ''; } else part += char; }
  result.push(part.trim()); return result;
}
function project(row: Row, selection: string) {
  if (columns(selection).includes('*')) return structuredClone(row);
  return Object.fromEntries(columns(selection).map(column => { const key = column.split('(')[0].trim(); return [key, structuredClone(row[key])]; }));
}

export function installBoundary() {
  const params = new URLSearchParams(location.search);
  const scenario = params.get('scenario') ?? 'populated';
  const blocked: string[] = [];
  const forbid = (description: string): never => { blocked.push(description); throw new Error(`Unavailable in local review: ${description}`); };
  window.overviewReview = {
    operations: [], blocked, scenario,
    async dismissAlpha() { sessionStorage.setItem('inkborne-overview-alpha-dismissed', 'true'); return { success: true }; },
    createClient() {
      return {
        auth: { async getUser() { return { data: { user: { id: 'local-overview-reviewer', email: 'review@example.invalid' } }, error: null }; } },
        from(table: string) {
          if (!['profiles', 'characters'].includes(table)) return forbid(`table ${table}`);
          let selection = '*', maximum: number | null = null;
          const filters: Array<[string, unknown]> = [];
          const query = {
            select(value: string) { selection = value; return query; },
            eq(column: string, value: unknown) { filters.push([column, value]); return query; },
            order(column: string, options: { ascending?: boolean } = {}) { if (column !== 'created_at' || options.ascending !== false) return forbid(`order ${column}`); return query; },
            limit(value: number) { maximum = value; return query; },
            async single() { const result = resolve(); return { ...result, data: result.data?.[0] ?? null }; },
            then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) { return Promise.resolve(resolve()).then(onFulfilled, onRejected); },
          };
          function resolve() {
            window.overviewReview.operations.push({ table, select: selection, filters, limit: maximum });
            if (table === 'profiles') return { data: [project({ id: 'local-overview-reviewer', display_name: params.get('name') === 'long' ? 'Alexandria Amberweather of the Seven Lanterns' : 'Rowan', avatar_url: null, preferences: params.get('alpha') === 'visible' && sessionStorage.getItem('inkborne-overview-alpha-dismissed') !== 'true' ? {} : { alpha_banner_dismissed_at: '2026-10-24T00:00:00Z' } }, selection)], error: null };
            if (scenario === 'error') return { data: null, error: { message: 'Simulated local character-list failure', details: null, hint: null } };
            let data = scenario === 'empty' ? [] : scenario === 'single' ? fixtureCharacters.slice(0, 1) : structuredClone(fixtureCharacters);
            if (scenario === 'long') data = data.map((row, index) => index === 5 ? { ...row, created_at: '2026-10-25T12:00:00Z' } : row);
            data.sort((first, second) => second.created_at.localeCompare(first.created_at));
            data = data.filter(row => filters.every(([key, value]) => (row as unknown as Row)[key] === value));
            if (maximum != null) data = data.slice(0, maximum);
            return { data: data.map(row => project(row as unknown as Row, selection)), error: null };
          }
          return query;
        },
        rpc(name: string) { return forbid(`RPC ${name}`); },
      };
    },
  };
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => { const address = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href); const method = init?.method ?? (input instanceof Request ? input.method : 'GET'); if (address.origin !== location.origin || !['GET', 'HEAD'].includes(method.toUpperCase())) return Promise.reject(new Error(`Blocked local-review request: ${address.origin} ${method}`)); return originalFetch(input, init); };
  document.addEventListener('submit', event => { event.preventDefault(); blocked.push('form submission'); });
  HTMLFormElement.prototype.submit = function () { forbid('form submission'); };
  document.addEventListener('click', event => { const anchor = (event.target as HTMLElement).closest('a'); if (!anchor) return; const url = new URL(anchor.href, location.href); if (url.origin !== location.origin || !['/dashboard', '/characters', '/'].includes(url.pathname)) { event.preventDefault(); blocked.push(`navigation ${url.pathname}`); document.getElementById('review-status')!.textContent = 'That destination is outside this fictional local review.'; } });
}
