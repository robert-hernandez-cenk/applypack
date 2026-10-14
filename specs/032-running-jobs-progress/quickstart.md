# Quickstart: validating the live progress card

Prerequisites: a throwaway database (the route smoke inserts rows), `npm ci`, `npx prisma generate`.

## Automated

```bash
npm run lint:types && npm test          # run-progress, running-view, running.mjs, catalog parity
npm run exports:audit
npm run build && npm run smoke:routes   # throwaway DB only: /runs/running with and without a running row
```

## By hand (scratch data folder, never the live one)

```bash
APPLYPACK_DATA_DIR=/tmp/ap WEB_PORT=4848 APPLYPACK_NO_OPEN=1 npm start
```

1. Open `http://127.0.0.1:4848/runs`. With nothing running: no "Running now" card; the network tab shows no `/runs/running` requests.
2. Insert a running row with progress (psql against the built-in DB):
   `insert into cron_run (name, status, progress) values ('fetch','RUNNING','{"stage":"classify","label":"runs.running.stage.classify","unit":"runs.running.unit.postings","done":508,"total":663,"startedStageAt":"<now>","updatedAt":"<now>","counters":{"kept":41,"setAside":380,"errors":2},"samples":[[400,<t0>],[508,<t1>]]}');`
   Within 5 s the card appears without reload: bar "508 / 663", counters, ETA.
3. Set `updatedAt` three minutes back: the update line turns amber.
4. Set `progress` to null on that row: the card shows name and elapsed only; set the row `OK`: the card disappears and polling stops.
5. Open `/runs` with script disabled: the page reloads itself while a run is listed.
6. Switch the language (es, fr, uk) and the pseudo-language: no English in the card.

## Real run

Manual "Fetch now" keeps its own page and is out of scope; trigger the worker tick (`node dist/scripts/fetch-once.js` records `fetch-now`; the hourly `fetch` needs the worker) with a local model and watch the counter move and the ETA settle after 20 postings.
