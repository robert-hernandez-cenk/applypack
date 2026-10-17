/*
 * The No Offer column's collapse on /applications (ADR 0080). On a wide screen
 * the column folds to a narrow rail that keeps its title and count; the choice
 * is remembered in this browser only. The column and its button are rendered by
 * the server (`[data-collapsible]` holding `[data-collapse-toggle]`), so without
 * script the column is simply open. The rail's look is CSS keyed off
 * data-collapsed inside the page's md+ rules, so a phone never shows it. The
 * toggle is a real <button>: Enter and Space work, and aria-expanded says which
 * state it is in. Storage can be blocked (private window, site data off): every
 * read and write is guarded and the page works without it. Importing this file
 * under node:test touches no DOM.
 */

import { t } from './i18n.mjs';

export const COLLAPSE_KEY = 'applypack.board.noOffer.collapsed';
const COLLAPSED = '1';

/** Whether the column was left collapsed. Anything but a stored "1" is expanded. */
export function readCollapsed(storage) {
  try {
    return storage?.getItem(COLLAPSE_KEY) === COLLAPSED;
  } catch {
    return false;
  }
}

/** Remember the choice. Expanded is the default, so it removes the entry instead of storing it. */
export function writeCollapsed(storage, collapsed) {
  try {
    if (collapsed) storage?.setItem(COLLAPSE_KEY, COLLAPSED);
    else storage?.removeItem(COLLAPSE_KEY);
  } catch {
    // Blocked storage: the column starts open next time, which is fine.
  }
}

export function toggled(collapsed) {
  return !collapsed;
}

function browserStorage(doc) {
  try {
    return doc.defaultView?.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Wire the column; returns 1 when there is one to wire, else 0. */
export function initCollapse(doc, storage = browserStorage(doc)) {
  const column = doc.querySelector('[data-collapsible]');
  const button = column?.querySelector('[data-collapse-toggle]');
  if (!column || !button) return 0;

  const show = (collapsed) => {
    column.setAttribute('data-collapsed', String(collapsed));
    button.setAttribute('aria-expanded', String(!collapsed));
    button.setAttribute('aria-label', t(collapsed ? 'browser.board.expandNoOffer' : 'browser.board.collapseNoOffer'));
  };

  let collapsed = readCollapsed(storage);
  show(collapsed);

  button.addEventListener('click', () => {
    collapsed = toggled(collapsed);
    writeCollapsed(storage, collapsed);
    show(collapsed);
  });

  // A card dragged over the rail opens it so there is something to drop on.
  // The saved choice is left as it was: this is only for the drag.
  column.addEventListener('dragenter', () => {
    if (collapsed) {
      collapsed = false;
      show(false);
    }
  });
  return 1;
}
