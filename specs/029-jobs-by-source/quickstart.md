# Quickstart: validating "Jobs by source"

## Automated

```bash
npm run lint:types
npm test            # overview-numbers.test.ts (topSources), catalog.test.ts (all four languages)
```

## Route smoke (throwaway database only)

```bash
npm run build && npm run smoke:routes
```

The Overview renders in English and in the pseudo-language; a new word of ours outside the catalog fails the pseudo pass (names that are data carry `translate="no"`).

## By eye

1. Start the dashboard on a scratch data folder with a few matches from different sources
   (`APPLYPACK_DATA_DIR=/tmp/ap WEB_PORT=4848 APPLYPACK_NO_OPEN=1 npm start` — never the live folder).
2. Open `/`. Under **Jobs by stack** there is **Jobs by source**:
   - vendor boards appear as one **Company boards** bar;
   - Gmail, a folder, an import, pasted jobs and each aggregator have their own bar;
   - the footer says "Out of N matches in the last 30 days" and the counts add up to N (≤ 8 sources);
   - the bars are not links.
3. With no matches in the window the card is absent.
4. Switch the language (es, fr, uk): title, info, "Company boards" and footer are translated; "Greenhouse", "RemoteOK" stay as written.
5. Phone width (375 px): the card stacks under the stack card with no horizontal scroll; bars keep the stack card's look.
