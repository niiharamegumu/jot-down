# Jot Down

Jot Down is a local-first Markdown note PWA for quickly writing lightweight notes that can include checkable tasks.

## Product Direction

- Local-first and offline-first.
- No authentication, account, server-side app state, or cross-device sync.
- One-screen writing experience inspired by Apple Notes.
- Markdown text is the source of truth.
- Editing and structured display are integrated in the same surface.

## Initial Scope

- Multiple notes stored in the browser's local note store.
- Autosave without a user-facing save button.
- Note titles derived from the first Markdown heading, or the first non-empty line.
- Notes ordered by last Markdown edit time.
- Note search by case-insensitive partial text matching.
- Confirmed note deletion with no trash or recovery area.
- A starter note for first-run onboarding.

## Supported Markdown

Jot Down treats these Markdown shapes as first-class:

- Headings.
- Paragraphs.
- `-` bullet lists.
- `- [ ]` and `- [x]` checkable tasks.

Other Markdown-like text is kept as note text but is not treated as a first-class structure in the initial version.

## PWA Usage

The app is installable as a PWA through the browser's standard install action when supported. Jot Down does not show an in-app install prompt in the initial version.

When an installed PWA detects a newly available app version, it shows a persistent update bar. The update is applied only after the user chooses to update, and the active note is saved before the app reloads.

## Development Checks

Install dependencies with `npm install` to also register the repository's Git hooks.

- `npm run format` formats tracked source and documentation files with Biome.
- `npm run lint` runs ESLint, including React Hooks and React Refresh checks.
- `npm run typecheck` runs TypeScript project references with `tsc -b`.
- `npm run check` runs format verification, lint, and type checking. The same check runs before `git push`.

## Out Of Scope Initially

- User accounts.
- Cloud sync.
- Import/export.
- Folders, tags, and pinned notes.
- Due dates, reminders, and notifications.
- Separate preview mode.
- App-specific settings screen.
