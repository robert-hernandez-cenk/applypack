/*
 * Whether this dashboard asks people to sign in, for the one place a page
 * needs to know: the menu's Sign out (ADR 0064). Set once as the app is
 * assembled, read while pages are drawn.
 */

let enabled = false;

export function markSignInEnabled(): void {
  enabled = true;
}

export function signInEnabled(): boolean {
  return enabled;
}
