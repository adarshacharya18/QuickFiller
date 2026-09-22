/**
 * QuickFiller Copilot Drawer lifecycle, state persistence,
 * and sensitive URL exclusion utilities.
 */

export const SENSITIVE_OR_AUTH_URL_PATTERNS: RegExp[] = [
  // Google Authentication & Accounts
  /^https?:\/\/accounts\.google\.com/i,
  // Microsoft Identity, Live, and Azure AD OAuth
  /^https?:\/\/login\.microsoftonline\.com/i,
  /^https?:\/\/login\.live\.com/i,
  // Apple ID & iCloud Sign-in
  /^https?:\/\/appleid\.apple\.com/i,
  // Auth0 Universal Login
  /^https?:\/\/[a-z0-9-]+\.auth0\.com/i,
  // Okta Identity
  /^https?:\/\/[a-z0-9-]+\.okta\.com/i,
  // Atlassian ID
  /^https?:\/\/auth\.atlassian\.com/i,
  // Internal browser protocols & extension pages
  /^(chrome|chrome-extension|moz-extension|about|edge|view-source):/i,
];

/**
 * Returns true if the URL belongs to a sensitive authentication portal (e.g. accounts.google.com)
 * or internal browser protocol where QuickFiller should never mount, inject, or display UI.
 */
export function isSensitiveOrInternalUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return true;
  const clean = url.trim();
  if (!clean) return true;
  return SENSITIVE_OR_AUTH_URL_PATTERNS.some((pattern) => pattern.test(clean));
}

/**
 * Checks whether a given URL is eligible for QuickFiller Copilot Drawer.
 * Excludes sensitive authentication pages and internal browser URLs.
 */
export function isEligibleForDrawer(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim();
  if (isSensitiveOrInternalUrl(clean)) return false;
  return clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('file://');
}

/**
 * Determines whether the Copilot Drawer should be open on initial mount.
 * Default is FALSE on new pages (closed, showing only the subtle floating launcher button)
 * to avoid covering user screens or popping up unexpectedly on arbitrary websites.
 */
export function getInitialDrawerOpenState(): boolean {
  if (typeof window === 'undefined') return false;

  // 1. Explicit auto-open flag set by toolbar popup launcher or shortcut injection
  if ((window as any).__QUICKFILLER_AUTO_OPEN__) {
    (window as any).__QUICKFILLER_AUTO_OPEN__ = false;
    try {
      sessionStorage.setItem('quickfiller_drawer_open', 'true');
    } catch {}
    return true;
  }

  // 2. Read stored preference for this session / tab
  try {
    const stored = sessionStorage.getItem('quickfiller_drawer_open');
    if (stored === 'false') return false;
    if (stored === 'true') return true;
  } catch {}

  // 3. Default to FALSE on new pages (closed, drawer does not open automatically)
  return false;
}

/**
 * Determines whether the Copilot Drawer should be in expanded (wide) view on initial mount.
 */
export function getInitialDrawerExpandedState(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const stored = sessionStorage.getItem('quickfiller_drawer_expanded');
    if (stored === 'false') return false;
    if (stored === 'true') return true;
    sessionStorage.setItem('quickfiller_drawer_expanded', 'true');
  } catch {}
  return true;
}
