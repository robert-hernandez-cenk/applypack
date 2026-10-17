/*
 * Forms that change one part of a page without leaving it (#53, ADR 0081).
 * A keyword edit used to post, get a 303 and load the whole page again: the
 * view jumped to the top, focus was lost and the tailor page's live editor
 * started over. A form marked `data-inline` posts with fetch instead, follows
 * the same redirect (the server answers every client alike; the flash cookie
 * is set by the post and read by the page it lands on), and replaces each
 * `[data-region]` of the current page with the element of the same id in the
 * page that came back. Without script, or without fetch, the form posts as it
 * always did. Dependency-free ES module served as-is; the decisions are pure
 * and tested from src/web/inline-post.test.ts, the DOM glue in a browser.
 *
 * Contract: specs/053-tailor-edits-no-reload/contracts/inline-regions.md.
 */

import { t } from './i18n.mjs';
import { announce } from './copy.mjs';
import { wireSelectCommits } from './select-commit.mjs';

/** Where the message of a post lives, and the regions' marker. */
const FLASH_SLOT = 'flash-slot';
const REGION = '[data-region]';
/** What a control is, as the page writes it: a field a person can land on. */
const CONTROLS = 'input:not([type=hidden]), select, textarea, button';
/** The look of a request in flight: the form is the same, but not ready for another press. */
const BUSY_OPACITY = '0.6';
/** The error tone and shape of the server's own flash (ui.tsx), so a failure reads like any other message. */
const FAILURE_CLASS = 'mb-4 flex items-start gap-2.5 rounded-md border px-3.5 py-2.5 text-sm border-danger/25 bg-danger/5 text-danger';

/**
 * What to do with the page a post came back with. Swap the regions the current
 * page has when the answer is this same page and carries all of them; anything
 * else (a sign-in page, another address, a region gone) is not the page being
 * edited, so go where the server went.
 */
export function planSwap(currentIds, incomingIds, currentPath, finalPath) {
  if (currentIds.length === 0 || finalPath !== currentPath) return { kind: 'navigate' };
  const incoming = new Set(incomingIds);
  if (!currentIds.every((id) => incoming.has(id))) return { kind: 'navigate' };
  return { kind: 'swap', ids: [...currentIds] };
}

/**
 * The control focus should land on after a swap replaced the one it was on:
 * the same one (form action, keyword, field name), else the first control of
 * the same keyword, else the add field. `null` when the page has none of them.
 */
export function pickFocus(candidates, wanted) {
  const same = (c) => c.action === wanted.action && c.term === wanted.term;
  return (
    candidates.find((c) => same(c) && c.name === wanted.name) ??
    candidates.find(same) ??
    candidates.find((c) => c.term === '' && c.name === 'term') ??
    null
  );
}

/** The urlencoded body for [name, value] pairs, order and repeated names kept. */
export function formBody(entries) {
  const params = new URLSearchParams();
  for (const [name, value] of entries) params.append(name, value);
  return params.toString();
}

/** One job at a time, in the order they were pushed; a job that throws does not stop the next. */
export function createQueue() {
  let tail = Promise.resolve();
  return {
    push(job) {
      const run = tail.then(job);
      const settled = run.catch(() => undefined);
      tail = settled;
      return settled;
    },
  };
}

/** The open/closed state of folds, by name. */
export function foldStates(folds) {
  return Object.fromEntries(folds.map((f) => [f.fold, f.open]));
}

/** Put remembered states back on the folds that have a name in them. */
export function applyFolds(folds, states) {
  for (const f of folds) if (f.fold in states) f.open = states[f.fold];
}

/* ---------- the DOM glue ---------- */

/** Folds under `root` as objects `foldStates` / `applyFolds` can read and write. */
function foldViews(root) {
  return [...root.querySelectorAll('details[data-fold]')].map((el) => ({
    get fold() {
      return el.dataset.fold;
    },
    get open() {
      return el.open;
    },
    set open(value) {
      el.open = value;
    },
  }));
}

/** A control as `pickFocus` knows it, with the element it came from. */
function describeControl(el) {
  const form = el.closest('form');
  return {
    action: form?.getAttribute('action') ?? '',
    term: form?.querySelector('input[type=hidden][name=term]')?.getAttribute('value') ?? '',
    name: el.getAttribute('name') ?? '',
    el,
  };
}

/** Scripts a parsed page carries do not run when moved; a fresh copy does (a refused field marks itself that way). */
function reviveScripts(root) {
  for (const old of root.querySelectorAll('script')) {
    const fresh = document.createElement('script');
    for (const { name, value } of old.attributes) fresh.setAttribute(name, value);
    fresh.textContent = old.textContent;
    old.replaceWith(fresh);
  }
}

/** The error line, in the message area; "not saved" must never look like a saved page. */
function showFailure() {
  const slot = document.getElementById(FLASH_SLOT);
  const message = t('browser.inline.failed');
  announce(message);
  if (!slot) return;
  const line = document.createElement('div');
  line.setAttribute('role', 'alert');
  line.className = FAILURE_CLASS;
  const text = document.createElement('span');
  text.className = 'min-w-0 flex-1';
  text.textContent = message;
  line.appendChild(text);
  slot.replaceChildren(line);
}

/** Replace the regions with the returned page's, keep focus, scroll and folds, tell the page. */
function swapRegions(incomingDoc) {
  const { scrollX, scrollY } = window;
  const active = document.activeElement;
  const wanted = active && active.closest?.(`${REGION} form`) ? describeControl(active) : null;
  const states = foldStates(foldViews(document));
  for (const current of document.querySelectorAll(REGION)) {
    const incoming = incomingDoc.getElementById(current.id);
    if (!incoming) continue;
    const fresh = document.importNode(incoming, true);
    current.replaceWith(fresh);
    reviveScripts(fresh);
    wireSelectCommits(fresh);
  }
  applyFolds(foldViews(document), states);
  if (wanted) {
    const candidates = [...document.querySelectorAll(`${REGION} ${CONTROLS}`)].map(describeControl);
    pickFocus(candidates, wanted)?.el.focus({ preventScroll: true });
  }
  window.scrollTo(scrollX, scrollY);
  const flash = document.getElementById(FLASH_SLOT);
  if (flash && flash.textContent.trim() !== '') announce(flash.textContent.trim());
  document.dispatchEvent(new CustomEvent('inline:swapped', { detail: { doc: incomingDoc } }));
}

/** Post one snapshot and show its result. Throws only for what the person must be told: not saved. */
async function send({ action, body }) {
  const res = await fetch(action, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    credentials: 'same-origin',
    body,
  });
  if (!res.ok) throw new Error(`status ${res.status}`);
  const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
  const currentIds = [...document.querySelectorAll(REGION)].map((el) => el.id);
  const incomingIds = [...doc.querySelectorAll(REGION)].map((el) => el.id);
  const plan = planSwap(currentIds, incomingIds, location.pathname, new URL(res.url).pathname);
  if (plan.kind === 'navigate') {
    location.assign(res.url);
    return;
  }
  swapRegions(doc);
}

/**
 * Every `form[data-inline]` under `root` posts in place. One listener on the
 * root, so forms that arrive in a swapped region need no wiring of their own.
 */
export function wireInlinePosts(root) {
  if (typeof fetch !== 'function' || typeof DOMParser !== 'function') return;
  const queue = createQueue();
  const inFlight = new WeakSet();
  root.addEventListener('submit', (event) => {
    const form = event.target;
    if (event.defaultPrevented || !form.matches?.('form[data-inline]')) return;
    event.preventDefault();
    // A second press of a form already waiting would apply the edit twice.
    if (inFlight.has(form)) return;
    const entries = [...new FormData(form)].filter(([, value]) => typeof value === 'string');
    const submitter = event.submitter;
    if (submitter?.name) entries.push([submitter.name, submitter.value]);
    const snapshot = { action: form.getAttribute('action') ?? location.pathname, body: formBody(entries) };
    inFlight.add(form);
    form.setAttribute('aria-busy', 'true');
    form.style.opacity = BUSY_OPACITY;
    queue.push(async () => {
      try {
        await send(snapshot);
      } catch {
        showFailure();
      } finally {
        inFlight.delete(form);
        form.removeAttribute('aria-busy');
        form.style.opacity = '';
      }
    });
  });
}
