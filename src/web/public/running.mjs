/*
 * The "Running now" card on /runs (ADR 0072). The card is server-rendered; this
 * module only asks for it again every few seconds and swaps it in. An empty
 * answer means nothing runs any more: the card is removed and polling stops.
 * A failed request keeps the card as it was and tries again. Without script
 * the page reloads itself instead (layout.tsx refreshWithoutScript).
 * Pure around its injected fetch / timer / visibility — tested from
 * src/web/running.test.ts.
 */

const DEFAULT_URL = '/runs/running';
const DEFAULT_EVERY_MS = 5000;

/** What to do with an answer: 'swap' it in, 'remove' the card, or 'keep' what is shown. */
export function nextState(ok, body) {
  if (!ok) return 'keep';
  return body.trim() === '' ? 'remove' : 'swap';
}

export async function refresh(host, url, fetchImpl) {
  let state = 'keep';
  let body = '';
  try {
    const resp = await fetchImpl(url, { headers: { Accept: 'text/html' }, credentials: 'same-origin' });
    body = await resp.text();
    state = nextState(resp.ok, body);
  } catch {
    return 'keep';
  }
  if (state === 'swap') host.innerHTML = body;
  else if (state === 'remove') host.innerHTML = '';
  return state;
}

export async function init(
  host,
  {
    url = DEFAULT_URL,
    everyMs = DEFAULT_EVERY_MS,
    fetchImpl = (...args) => fetch(...args),
    schedule = (fn, ms) => void setTimeout(fn, ms),
    isHidden = () => document.hidden,
  } = {},
) {
  const tick = async () => {
    // A background tab asks nothing; it catches up on the next beat after it is shown.
    if (!isHidden() && (await refresh(host, url, fetchImpl)) === 'remove') return;
    schedule(tick, everyMs);
  };
  schedule(tick, everyMs);
}
