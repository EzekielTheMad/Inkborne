# Inkborne — Brand Reference

Technical design tokens for the Inkborne platform. This is a developer reference, not a marketing brand guide.

## Color Palette

### Dark Theme (Default)

| Token | Hex | Usage |
|---|---|---|
| --background | #0b0a10 | Page background |
| --foreground | #f0eef5 | Primary text |
| --card | #13111d | Card/panel backgrounds |
| --card-foreground | #f0eef5 | Card text |
| --primary | #7c3aed | CTA buttons, active states, links |
| --primary-foreground | #fafafa | Text on primary buttons |
| --secondary | #1e1b2e | Secondary backgrounds |
| --secondary-foreground | #c4c0d0 | Secondary text |
| --muted | #13111d | Muted backgrounds |
| --muted-foreground | #8b85a0 | Subtitle, placeholder text |
| --accent | #c9a44a | Gold — brand color, headings, highlights |
| --accent-foreground | #0b0a10 | Text on gold backgrounds |
| --destructive | #dc2626 | Delete, error states |
| --destructive-foreground | #fafafa | Text on destructive buttons |
| --border | #1e1b2e | Borders, dividers |
| --input | #1e1b2e | Input field borders |
| --ring | #7c3aed | Focus rings |

### Light Theme

Not yet defined. Structure supports it — values TBD in a future sub-project.

## Typography

- **Font stack:** `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- **Custom font:** Not yet selected. A custom font can be added later.
- **Gold accent:** Used for brand name, content titles, feature headings
- **Purple primary:** Used for buttons, links, interactive elements

## Spacing & Radius

- **Border radius:** Uses shadcn/ui default radius variable (`--radius`)
- **Spacing:** Tailwind default scale (4px increments)
- **Container:** `container mx-auto px-4` (max-width with horizontal padding)

## Component Patterns

- **Buttons:** shadcn/ui Button component with variants (default=purple, outline, ghost, destructive)
- **Cards:** shadcn/ui Card with bg-card border-border
- **Forms:** shadcn/ui Input, Label, Select components
- **Modals:** shadcn/ui Dialog
- **Navigation:** Custom NavLink with active detection, DropdownMenu for user menu, Sheet for mobile
- **Tabs:** shadcn/ui Tabs component

## Usage Rules

1. **Always use semantic color classes** — never raw Tailwind colors
2. **Gold accent (text-accent)** for brand elements and content titles
3. **Purple primary (bg-primary)** for action buttons and interactive elements
4. **Muted foreground (text-muted-foreground)** for secondary/subtitle text
5. **Destructive (bg-destructive)** only for delete/error actions
