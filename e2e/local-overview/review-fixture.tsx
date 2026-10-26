/** Imports the actual async application pages. Only their I/O edges are fixtures. */
import React, { type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, useTheme } from '@/components/theme-provider';
import { AppNav } from '@/components/nav/app-nav';
import { MobileNav } from '@/components/nav/mobile-nav';
import { FeedbackProvider } from '@/components/feedback/feedback-provider';
import { CharacterRouteFrame } from '@/components/character/character-route-frame';
import DashboardPage from '@/app/(app)/dashboard/page';
import CharactersPage from '@/app/(app)/characters/page';
import { installBoundary } from './review-boundaries';

installBoundary();
function ReviewControls() {
  const { theme, setTheme } = useTheme();
  const params = new URLSearchParams(location.search);
  return <aside aria-label="Local review controls" className="border-b border-border bg-card px-4 py-2 text-sm flex flex-wrap items-center gap-3">
    <strong>Local overview review</strong><span>Fictional characters. No hosted data or account actions.</span>
    <label className="ml-auto">Review theme <select aria-label="Review theme" value={theme} onChange={event => setTheme(event.target.value as 'light' | 'dark' | 'system')} className="ml-2 border border-border bg-background text-foreground px-2 py-1 rounded"><option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option></select></label>
    <label>State <select aria-label="Review state" defaultValue={params.get('scenario') ?? 'populated'} onChange={event => { params.set('scenario', event.target.value); location.assign(location.pathname + '?' + params.toString()); }} className="ml-2 border border-border bg-background text-foreground px-2 py-1 rounded">{['populated', 'empty', 'single', 'error', 'long'].map(value => <option value={value} key={value}>{value}</option>)}</select></label>
    <a className="underline" href={'/dashboard?' + params}>Dashboard</a><a className="underline" href={'/characters?' + params}>Characters</a>
    <span id="review-status" role="status" />
  </aside>;
}
function App({ page }: { page: ReactNode }) {
  const reviewer = { displayName: 'Rowan', avatarUrl: null, email: 'review@example.invalid', isAdmin: false };
  return <ThemeProvider><CharacterRouteFrame>
    <ReviewControls />
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"><FeedbackProvider><div className="container mx-auto flex h-14 items-center justify-between px-4"><AppNav {...reviewer} /><MobileNav {...reviewer} /></div></FeedbackProvider></header>
    <main className="flex-1 container mx-auto px-4 py-6">{page}</main>
  </CharacterRouteFrame></ThemeProvider>;
}
async function render() {
  const page = location.pathname === '/characters' ? await CharactersPage() : await DashboardPage();
  createRoot(document.getElementById('root')!).render(<App page={page} />);
}
render().catch(error => { document.getElementById('root')!.textContent = `Local review could not render: ${error.message}`; console.error(error); });
