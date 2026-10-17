/*
 * Result messages as toasts (#54, ADR 0082). The server renders a message as a
 * banner in `#flash-slot` (ui.tsx `Flash`) and that is all a browser without
 * script gets. With script, this module marks the slot `data-toast`: the
 * layout's CSS pins it to the corner of the screen, so the message is seen
 * wherever the page is scrolled and moves nothing. It adds a close button,
 * closes a plain success after a time that grows with its length, and keeps a
 * warning, an error or a message that offers something to do until it is
 * closed. The banner's own role (status / alert) is the one announcement;
 * nothing here takes focus. Dependency-free ES module served as-is; the
 * decision is pure and tested from src/web/toast.test.ts, the DOM glue in a
 * browser.
 *
 * Contract: specs/054-toast-flash-messages/contracts/toast.md.
 */

import { t } from './i18n.mjs';

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

function bannerOf(slot) {
  return slot.querySelector('[role="status"], [role="alert"]');
}

/** The tone, from the role the server gave the banner and the class it was styled with. */
function kindOf(banner) {
  if (banner.getAttribute('role') === 'alert') return 'err';
  return banner.className.includes('text-warn') ? 'warn' : 'ok';
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
    slot.replaceChildren();
    slot.removeAttribute('data-toast');
    slot.removeAttribute('data-leaving');
    releaseFields();
  };
  if (reducedMotion()) finish();
  else {
    slot.setAttribute('data-leaving', '');
    setTimeout(finish, LEAVE_MS);
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
 * with no message is left as the empty, hidden thing it is.
 */
export function enhanceFlash(slot = document.getElementById(FLASH_SLOT)) {
  release();
  if (!slot) return;
  const banner = bannerOf(slot);
  if (!banner) {
    slot.removeAttribute('data-toast');
    return;
  }
  banner.querySelector('[data-toast-close]')?.remove();
  const plan = toastPlan({ kind: kindOf(banner), textLength: (banner.textContent ?? '').trim().length, hasAction: hasAction(banner) });
  const button = closeButton();
  banner.appendChild(button);
  slot.removeAttribute('data-leaving');
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
  // Read at leisure: the time stops while the pointer is on the message or focus is inside it.
  slot.addEventListener('pointerenter', disarm, { signal });
  slot.addEventListener('pointerleave', arm, { signal });
  slot.addEventListener('focusin', disarm, { signal });
  slot.addEventListener('focusout', arm, { signal });
  arm();
}

if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !event.defaultPrevented && open) close();
  });
  enhanceFlash();
}
