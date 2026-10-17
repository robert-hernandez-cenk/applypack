# 11a - Redrawn Flows

The six journeys from `10a`-`10c` that [11-flow-audit.md](./11-flow-audit.md) found weakest, redrawn with the branches the originals left out. Each branch comes from the source as the audit's checking pass read it. Finding numbers (F1, F2, ...) point to the audit table.

## Conventions

- Same as `10b` section 0: rectangles are screens, rounded nodes are user actions, diamonds are decisions, solid edges carry `METHOD /path`, dotted edges are no-reload `fetch` calls or browser-only behaviour.
- **Red nodes (`gap`) are places where the app has no behaviour.** They are not proposals. They mark the missing branch so a rewrite or a fix can decide what goes there.
- A note under each diagram lists what changed against the original and which finding it comes from.

---

## 1. R1 - A run on the progress page (replaces the repeated run fragments in 10a J11, 10b J1/J4/J5/J6/J9, 10c A2/A7)

```mermaid
flowchart TD
  P["Any violet or scan button"] -->|"POST starts the run"| K{"Same key already live?"}
  K -- "yes" --> JOIN["Join the live run"]
  K -- "no" --> NEW["Start run, 303 to progress page"]
  NEW --> PG["Progress page: step text, polls state every 2 s"]
  JOIN --> PG
  PG -.->|"GET state"| ST{"Run state"}
  ST -- "running" --> PG
  ST -- "done" --> RES["Reload, 303 to the run's result URL, flash"]
  ST -- "error" --> ER["Error panel with reason and a back link"]
  ST -- "unknown or expired" --> GONE{"Which page?"}
  GONE -- "target runs" --> G1["303 /jobs + flash: run gone, whatever started it"]
  GONE -- "fetch-now" --> G2["303 /runs + flash: fetch run gone"]
  GONE -- "cron run page" --> G3["303 /runs + flash: gone"]
  PG --> NOC["No cancel or stop control"]:::gap
  PG --> SESS["Poll after the session ended"]:::gap
  ER --> BK{"Back link target"}
  BK -- "default" --> B1["/jobs plus Open saved job"]
  BK -- "condense and tailor runs" --> B2["Back to the editor for that match"]
  classDef gap fill:#fde2e2,stroke:#b42318,color:#7a1c14
```

Changed: the "gone" redirect is split by page (F13), the missing cancel is drawn (F1), and the back link target is shown as two kinds. The poll after session expiry is a gap because the `/state` answer for a signed-out session was not checked.

---

## 2. R2 - Sign-in gate and every denial (replaces 10c B1, B2 and the denial edges in A1)

```mermaid
flowchart TD
  REQ["Request"] --> OIDC{"OIDC sign-in on?"}
  OIDC -- "no" --> ROLE
  OIDC -- "yes" --> SES{"Live session?"}
  SES -- "yes" --> ROLE
  SES -- "no" --> KIND{"Request kind"}
  KIND -- "GET with Accept text/html" --> LOG["303 /auth/login?next=..."]
  KIND -- "POST or any other" --> R401["401 plain text, form data lost"]:::gap
  R401 --> NOBACK["No route back, inline forms say not saved"]:::gap
  ROLE{"Role and route"}
  ROLE -- "member, admin-only route, page" --> P403["403 page with a home button"]
  ROLE -- "member, admin-only route, path ends /state" --> J403["403 JSON: forbidden"]
  ROLE -- "member, GET /welcome" --> W303["303 to / with no message"]
  ROLE -- "member, /settings?tab=screening" --> FB["200 with the Profile tab, no message"]
  ROLE -- "admin, /screen* with employer mode off" --> EM["303 /settings?tab=screening + warn flash"]
  ROLE -- "allowed" --> OK["Page renders"]
  classDef gap fill:#fde2e2,stroke:#b42318,color:#7a1c14
```

Changed: the order is now stated (sign-in gate first, then role, then employer mode), the four different answers to "not for you" sit side by side (F3), and the 401 on a POST is drawn with its dead end (F2). A member never reaches the employer-mode redirect, because the admin guard answers first.

---

## 3. R3 - Screening scoring run (replaces 10c A4's run branch)

```mermaid
flowchart TD
  S["Score or Score again on /screen/:id"] -->|"POST /screen/:id/..."| RUN["startScreeningRun, state held in web-process memory"]
  RUN --> PW["Workspace shows inline progress, polls GET .../state"]
  PW -.->|"2 s"| POLL{"Answer"}
  POLL -- "running true" --> PW
  POLL -- "running false" --> REL["Reload the page"]
  POLL -- "403" --> R403["Reload gives the 403 page, no poller, loop ends"]
  POLL -- "500 on /state only" --> LOOP["Reload every 2 s, no retry cap"]:::gap
  POLL -- "network error" --> RETRY["Retry in 2 s"]
  POLL -- "303 to HTML after employer mode off" --> JSONFAIL["res.json throws, retry every 2 s, page never reloads"]:::gap
  RUN --> RESTART{"Web process restarts"}
  RESTART --> LOST["Run is gone, nothing resumes by itself"]
  LOST --> PEND["Stored rows keep their state, listPending finds the unscored ones"]
  PEND --> AGAIN["Person presses Score again"]
  AGAIN --> RUN
  classDef gap fill:#fde2e2,stroke:#b42318,color:#7a1c14
```

Changed: the restart is drawn the way it behaves (F11) and the two poll loops are drawn (F10). A per-applicant failure leaves that row pending and "Score again" is its retry, which is unchanged from 10c.

---

## 4. R4 - Tailor editor: what keeps the draft (replaces 10b J5/J6 draft prose)

```mermaid
flowchart TD
  ED["Tailor editor /jobs/:id/target?match=N"] --> TYPE["Every keystroke writes localStorage target-draft:N"]
  TYPE --> LOAD["On load: draft if present, else the resume text"]
  ED --> ACT{"Action"}
  ACT -- "Analyse again" --> C1["POST with the draft text"]
  ACT -- "Save" --> C2["POST with the text"]
  ACT -- "Shorter wording or Refresh" --> C3["POST with the editor text"]
  ACT -- "Find cuts, per-card Rewrite, Rewrite all" --> N1["POST without the editor text"]
  ACT -- "Upload new version" --> N2["POST with the new file, not the editor text"]
  ACT -- "Navigate away or close" --> LEAVE["No leave guard, nothing asked"]:::gap
  C1 --> RUN["Progress page (R1)"]
  C3 --> RUN
  N1 --> RUN
  N2 --> RUN
  RUN -->|"done"| BACK["Same editor URL, draft reloads"]
  RUN -->|"condense run fails"| E1["Error panel, back link to /jobs/:id/target?match=N, draft reloads"]
  RUN -->|"comparison fails"| E2["Error panel, back link /jobs, Open saved job"]
  E2 --> REOPEN["Draft survives; reopen the same match to see it"]
  classDef gap fill:#fde2e2,stroke:#b42318,color:#7a1c14
```

Changed: the localStorage draft is drawn (F5), the carry or drop of editor text per action is a decision (F6), and the two failure back links are separated, because condense runs return to the editor and comparison runs do not.

---

## 5. R5 - Application pack queue (replaces 10b J12's lifecycle)

```mermaid
flowchart TD
  Q["Prepare pack on the job"] -->|"POST queue"| QD["Status queued, copy: starts within a minute"]
  QD -.->|"poll, no limit"| QD
  QD -->|"Cancel"| CX["cancelQueuedPack, back to the job"]
  QD --> W{"Worker running?"}
  W -- "yes" --> RN["Status running, step sentence, no cancel"]
  W -- "no" --> STUCK["Stays queued, no age check, no warning"]:::gap
  RN --> CMP{"Compare step"}
  CMP -- "fails" --> FL["Status failed, out.error"]
  CMP -- "ok" --> VER{"Verify step"}
  VER -- "fails" --> UNCK["Marked unchecked, pack continues"]
  VER -- "ok or skipped" --> LET{"Letter step"}
  UNCK --> LET
  LET -- "fails" --> NOLET["Pack continues without a letter"]
  LET -- "ok" --> GATE{"Gate verdict"}
  NOLET --> GATE
  GATE -- "closed, failed gate, low ceiling, fake or skip" --> SP["Status stopped, own notice"]
  GATE -- "nothing made or an error" --> FL
  GATE -- "ok" --> RDY["Status ready, Mark as sent"]
  FL --> TRY["Try again, confirm"]
  SP --> TRY
  RN --> RQ["Rows left running by a crash are requeued"]
  classDef gap fill:#fde2e2,stroke:#b42318,color:#7a1c14
```

Changed: the worker-down case is drawn (F4), failed is separated from stopped by what ends the run, and the differing step failures are shown (F20). The "ready" notification path for an automatic prepare was not checked and is not drawn.

---

## 6. R6 - What a resume needs before each button works (new, from F7 and F9)

```mermaid
flowchart TD
  U["Upload or version or re-render save"] -->|"scanInBackground"| SC["scannedAt set when the scan finishes"]
  RS["Resume"] --> B{"Button"}
  B -- "Strength review, Compare, Cover letter, Pack prepare" --> RAW["Runs on the raw text, scan not checked"]
  B -- "Create search from resume" --> G1{"Scanned?"}
  B -- "Fill profile from resume (wizard, Settings)" --> G2{"Scanned with a primary skill?"}
  G1 -- "no" --> BL["Blocked, scan first"]
  G1 -- "yes" --> GO1["Search created"]
  G2 -- "no" --> INL["Scans inline in the request, no progress page"]
  G2 -- "yes" --> GO2["Profile filled"]
  RAW --> SHOW["Only a Not scanned badge on the list and in Settings"]
  B -- "any violet button, budget spent" --> NOB["Runs anyway, budget only raises alerts at 80 and 100 percent"]:::gap
  classDef gap fill:#fde2e2,stroke:#b42318,color:#7a1c14
```

Changed: the two scan gates are separated from the four buttons that do not check, and the "AI unavailable" state does not exist in the app (F7, F9, F15).

---

## 7. Not redrawn

Journeys with findings that did not need a new diagram:

- Users admin (F17): one sentence is enough. There is no add route, and users appear at first sign-in as members.
- Flash TTL (F12): a number to fix in text, not a flow.
- Pages rendered from a POST (F8): add one line to the 10b J10 and J11 notes that a reload resubmits.
