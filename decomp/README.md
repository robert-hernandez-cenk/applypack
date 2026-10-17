# decomp

A reverse-engineered description of ApplyPack, built from the source code alone (no ADRs, specs, or project docs were used). Intended as the base for a from-scratch rewrite.

Read in this order:

| File | What it holds |
|---|---|
| [00-system-overview.md](./00-system-overview.md) | Context, containers, core loop, scheduler, cross-cutting concerns |
| [FEATURES.md](./FEATURES.md) | All 768 features in one checklist, by area |
| [01-data-model.md](./01-data-model.md) | ER diagrams, per-table notes, settings layering |
| [02-job-sourcing.md](./02-job-sourcing.md) | Ingestion routes, source families, dedupe |
| [03-job-pipeline-and-alerts.md](./03-job-pipeline-and-alerts.md) | Filter, classify, alerts, scheduler |
| [04-ai-layer.md](./04-ai-layer.md) | Engines, failover, ledger, task catalog |
| [05-resume-intake-and-match.md](./05-resume-intake-and-match.md) | Parsing and match scoring |
| [06-resume-tailoring-and-render.md](./06-resume-tailoring-and-render.md) | Tailoring, guardrails, rendering |
| [07-packs-applications-screening.md](./07-packs-applications-screening.md) | Packs, application tracking, employer screening |
| [08-web-app-and-ux.md](./08-web-app-and-ux.md) | Sitemap, filters, onboarding, settings |
| [09-platform-runtime-and-deploy.md](./09-platform-runtime-and-deploy.md) | Launcher, env, auth, i18n, CI |
| [10a-ui-flows-job-search.md](./10a-ui-flows-job-search.md) | UI flows: onboarding, overview, jobs, sources, runs, settings (19 journeys) |
| [10b-ui-flows-resume-and-apply.md](./10b-ui-flows-resume-and-apply.md) | UI flows: resumes, match, tailor/condense, letter, render, Reactive Resume, packs, tracker (13 journeys) |
| [10c-ui-flows-screening-admin-chrome.md](./10c-ui-flows-screening-admin-chrome.md) | UI flows: employer screening, sign-in, users, AI usage, global chrome and navigation map |
| [11-flow-audit.md](./11-flow-audit.md) | UX flow audit of 10a-10c: 20 findings checked against the source, cross-journey rules, refuted claims |
| [11a-redrawn-flows.md](./11a-redrawn-flows.md) | Six journeys redrawn with the missing branches (runs, sign-in and denial, screening run, tailor draft, pack queue, resume prerequisites) |

The 10x files carry screen inventories and per-journey flow diagrams. They were checked against the page code more closely than 08 and correct it in places (see the note at the top of 08).

Every area document has the same sections: purpose, architecture diagrams, flow diagrams, state machines, feature table, business rules (with constants), integrations, oddities a rewrite could drop, and a source map back to the code.

Diagrams are Mermaid. All Mermaid blocks in the area documents were parse-checked with mermaid 11. Facts were read from code by one agent per area and not run against a live app, so spot-check anything load-bearing against the source map before relying on it.
