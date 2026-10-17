/*
 * Result messages as toasts (#54, ADR 0082). The server renders a message as a
 * banner in `#flash-slot` (ui.tsx `Flash`) and that is all a browser without
 * script gets. With script, this module marks the slot `data-toast`: the
 * layout's CSS pins it to the corner of the screen, so the message is seen
 * wherever the page is scrolled and moves nothing. It adds a close button,
 * closes a plain success after a time that grows with its length, and keeps a
 * warning, an error or a message that offers something to do until it is
 * closed. An error's role=alert is its announcement; a status message that
 * arrives by an in-place post is spoken through the page's one polite live
 * region (copy.mjs), because a status element inserted already filled is not
 * reliably read. Nothing here takes focus. Dependency-free ES module served
 * as-is; the decision is pure and tested from src/web/toast.test.ts, the DOM
 * glue in a browser.
 *
 * Contract: specs/054-toast-flash-messages/contracts/toast.md.
 */

import { t } from './i18n.mjs';
import { announce } from './copy.mjs';

/** A success is read in 4 s at least and 12 s at most; between, it gets 40 ms a character. */
export const TOAST_MS = { base: 4000, perChar: 40, min: 4000, max: 12000 };

/** How long the leave transition runs (layout.tsx); skipped when the person asked for less motion. */
const LEAVE_MS = 160;
const FLASH_SLOT = 'flash-slot';
const FLASH_TEXT = 'flash-text';
/** What a person can press inside a message besides its own close button. */
const ACTIONS = 'a[href], button, input, select, textarea';
const CLOSE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

/**
 * Whether a message stays until it is closed, and if not, for how long.
 * Problems and choices stay (a failure must not be missed by looking away; a
 * button must not vanish while the person reaches for it); a plain success
 * goes by itself.
 */
export function toastPlan({ kind, textLength, hasAction }) {
  if (kind !== 'ok' || hasAction) return { sticky: true };
  const ms = TOAST_MS.base + TOAST_MS.perChar * Math.max(0, textLength);
  return { sticky: false, ms: Math.min(TOAST_MS.max, Math.max(TOAST_MS.min, ms)) };
}

/* ---------- the DOM glue ---------- */

/** The open toast's state: one slot, so one message at a time. */
let open = null;
/** The leave of a closed toast still running; a newer message cancels it so it cannot wipe that message. */
let leaving = null;

/** The banner carries its tone as `data-kind` (ui.tsx `Flash`, and inline-post.mjs's failure line). */
function bannerOf(slot) {
  return slot.querySelector('[data-kind]');
}

function kindOf(banner) {
  const kind = banner.getAttribute('data-kind');
  return kind === 'warn' || kind === 'err' ? kind : 'ok';
}

function hasAction(banner) {
  return banner.hasAttribute('data-sticky') || banner.querySelector(ACTIONS) !== null;
}

function reducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** A field the message was about stops pointing at a message that is gone. */
function releaseFields() {
  for (const field of document.querySelectorAll(`[aria-describedby~="${FLASH_TEXT}"]`)) {
    const rest = field.getAttribute('aria-describedby').split(/\s+/).filter((id) => id && id !== FLASH_TEXT);
    if (rest.length > 0) field.setAttribute('aria-describedby', rest.join(' '));
    else {
      field.removeAttribute('aria-describedby');
      field.removeAttribute('aria-invalid');
    }
  }
}

/** Forget the open toast: its timer and listeners. The slot itself is left as it is. */
function release() {
  if (leaving) {
    clearTimeout(leaving.timer);
    leaving.slot.removeAttribute('data-leaving');
    leaving = null;
  }
  if (!open) return;
  clearTimeout(open.timer);
  open.abort.abort();
  open = null;
}

/** Close the toast on screen: fade out (unless motion is reduced), then empty the slot. */
function close() {
  if (!open) return;
  const { slot } = open;
  release();
  const finish = () => {
    leaving = null;
    slot.replaceChildren();
    slot.removeAttribute('data-toast');
    slot.removeAttribute('data-leaving');
    releaseFields();
  };
  if (reducedMotion()) finish();
  else {
    slot.setAttribute('data-leaving', '');
    leaving = { slot, timer: setTimeout(finish, LEAVE_MS) };
  }
}

function closeButton() {
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('data-toast-close', '');
  button.setAttribute('aria-label', t('browser.toast.dismiss'));
  button.innerHTML = CLOSE_ICON;
  return button;
}

/**
 * Make the message in `#flash-slot` a toast. Run after the page loads and
 * after a region swap or a failure line replaced the slot (inline-post.mjs).
 * Safe to run twice; a newer message takes over from an older one. A slot
 * with no message is left as the empty thing it is. `spoken` is for a message
 * that arrived after the page did: a status banner then hands its announcing
 * to the page's polite live region (an error keeps role=alert).
 */
export function enhanceFlash(slot = document.getElementById(FLASH_SLOT), { spoken = false } = {}) {
  release();
  if (!slot) return;
  const banner = bannerOf(slot);
  if (!banner) {
    slot.removeAttribute('data-toast');
    return;
  }
  banner.querySelector('[data-toast-close]')?.remove();
  const text = (banner.textContent ?? '').trim();
  const kind = kindOf(banner);
  const plan = toastPlan({ kind, textLength: text.length, hasAction: hasAction(banner) });
  if (spoken && banner.getAttribute('role') === 'status') {
    banner.removeAttribute('role');
    announce(text);
  }
  const button = closeButton();
  banner.appendChild(button);
  slot.setAttribute('data-toast', '');

  const abort = new AbortController();
  const state = { slot, abort, timer: 0 };
  open = state;
  const arm = () => {
    clearTimeout(state.timer);
    if (!plan.sticky) state.timer = setTimeout(close, plan.ms);
  };
  const disarm = () => clearTimeout(state.timer);
  const { signal } = abort;
  button.addEventListener('click', close, { signal });
  // Read at leisure: the time stops while the pointer is on the message or focus is inside it,
  // and starts again only when neither is.
  slot.addEventListener('pointerenter', disarm, { signal });
  slot.addEventListener('pointerleave', () => { if (!slot.matches(':focus-within')) arm(); }, { signal });
  slot.addEventListener('focusin', disarm, { signal });
  slot.addEventListener('focusout', (event) => {
    if (!slot.contains(event.relatedTarget) && !slot.matches(':hover')) arm();
  }, { signal });
  arm();
}

if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !event.defaultPrevented && open) close();
  });
  enhanceFlash();
}
