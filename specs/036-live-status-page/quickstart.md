# Quickstart / validation

1. `npm run lint:types && npm test` in the worktree.
2. Build and run the route smoke on a throwaway database (see CLAUDE.md, Testing): the new step inserts a RUNNING row with a progress report, checks `/runs` carries "Live Status" for it only, opens `/runs/:id` and `/runs/:id/card`, marks the row OK, checks the card is empty and the page shows the outcome, then checks `/runs/999999`, `/runs/abc` and another person's run redirect to `/runs`.
3. Browser check at desktop and phone width: start "Fetch now" (or use `scripts` to hold a row RUNNING), follow the link, watch the page update, let the run end and see the outcome.
