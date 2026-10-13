# Implementation Plan: Dark theme for the dashboard

**Branch**: `issue-4-dark-theme` | **Date**: 2026-10-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-dark-theme/spec.md` (GitHub issue #4)

## Summary

The dashboard styles everything through named colour tokens (`src/web/tokens.ts` → `:root` custom properties → `tailwind.config.js` `rgb(var(--x) / <alpha-value>)`). `DESIGN.md` already says a dark theme is "a second set of values, not a component rewrite". The plan adds a second token record, emits it under `[data-theme=dark]` and under `prefers-color-scheme: dark` (unless `data-theme=light`), stores the System / Light / Dark choice in a plain `theme` cookie that the server reads on every request and writes to `<html data-theme>`, and adds a three-way switch that POSTs to a new same-origin route. A handful of literal colours (shadows, backdrops, one `bg-white`) become theme-aware. See [research.md](./research.md) for the decisions.

## Technical Context

**Language/Version**: TypeScript strict, Node 24 (engines >=22)
**Primary Dependencies**: Hono (`hono/cookie`, `hono/jsx`), Tailwind CLI (existing); no new dependency
**Storage**: a browser cookie only — no Prisma schema change, no migration
**Testing**: `node --test` over pure modules (`tokens.test.ts`, new `theme.test.ts`, `catalog.test.ts`, `self-contained.test.ts`); route smoke (`npm run smoke:routes`) on a throwaway DB; manual browser check at desktop and phone widths
**Target Platform**: the dashboard in any evergreen browser, local (`npm start`) and Docker
**Project Type**: web application (Hono server-rendered dashboard, separate from the worker)
**Performance Goals**: no extra request or script on the critical path; first paint already themed
**Constraints**: no inline script needed for first paint (server renders `data-theme`); self-contained rules unchanged; the worker must not import the web module
**Scale/Scope**: ~20 pages share one layout; ~8 literal-colour sites to fix

## Constitution Check

`.specify/memory/constitution.md` is the unfilled template, so there are no project principles to gate on. The binding rules are `CLAUDE.md` and `DESIGN.md`, checked here:

- Pure modules tested; side effects isolated: `theme.ts` is pure plus an AsyncLocalStorage holder (same shape as `language.ts`); the cookie read/write sits in `app.ts` and the route.
- Named exports only; no `console.log`; no magic numbers (cookie name, lifetime are constants).
- External data: the cookie value is parsed by a total function that maps anything unknown to `system`.
- i18n: every new string is a key in all four catalogs (`en`, `es`, `fr`, `uk`) in this change (`catalog.test.ts`).
- DESIGN.md: its "Don't go dark ad hoc" rule is satisfied by doing it at the token layer; the "only a light theme" paragraph and the direction contract are updated.
- Generated `src/web/public/tailwind.css` is regenerated and committed (`npm run css`).

Post-design re-check: no violations. No architecture, schema, dependency or source policy changes, so no ADR is written; the PR notes this.

## Project Structure

### Documentation (this feature)

```text
specs/004-dark-theme/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/theme-route.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
src/web/
├── tokens.ts            # + DARK_TOKENS (same keys), rootBlock emits both sets
├── tokens.test.ts       # the same AA matrix over the dark set
├── theme.ts             # NEW pure: parseTheme, themeAttr, THEME_COOKIE, withTheme/currentTheme (ALS)
├── theme.test.ts        # NEW
├── theme-switch.tsx     # NEW: three-way System/Light/Dark control (sidebar foot + Settings → General)
├── layout.tsx           # <html data-theme>, TOKENS_CSS color-scheme + scrims, mount switch
├── app.ts               # middleware reads the cookie → withTheme(...)
├── routes/settings.tsx  # POST /settings/theme (sets the cookie, redirects back)
├── ui.tsx               # toggle knob, popover backdrop
├── language-menu.tsx    # popover backdrop
├── oidc/pages.ts        # sign-in page honours the cookie too
├── pages/target.tsx     # document pane keeps its white page
├── pages/settings.tsx   # theme row in General
└── public/tailwind.css  # regenerated
src/i18n/catalog/{en,es,fr,uk}.json   # theme.* keys
tailwind.config.js       # shadows read a token
DESIGN.md                # dark theme documented, direction contract updated
docs/where-to-look.md    # row for "theme"
```

**Structure Decision**: single existing web service; one new pure module plus one new component, following the `language.ts` / `language-menu.tsx` pair that already solves the same problem (a per-request setting, a layout-level switch, a POST route that redirects back).

## Complexity Tracking

No violations to justify.
