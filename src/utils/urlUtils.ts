/**
 * URL Normalization & Sanitization Utilities for QuickFiller.
 * Ensures social profiles (LinkedIn, GitHub, Portfolio) match strict enterprise ATS
 * validation requirements (e.g. Workday, Greenhouse, Lever, Taleo).
 */

/**
 * Normalizes any LinkedIn profile URL into the canonical, ATS-compliant format:
 * `https://www.linkedin.com/in/<username>`
 *
 * Handles:
 * - Regional country subdomains (e.g. `in.linkedin.com`, `uk.linkedin.com`, `ca.linkedin.com`) -> `www.linkedin.com`
 * - Mobile subdomains (`m.linkedin.com`) -> `www.linkedin.com`
 * - Missing `www.` (`https://linkedin.com/in/...`) -> `https://www.linkedin.com/in/...`
 * - Insecure protocol (`http://`) -> `https://`
 * - Missing protocol (`linkedin.com/in/...` or `www.linkedin.com/in/...`) -> `https://www.linkedin.com/in/...`
 * - Trailing slashes (`.../in/username/`) -> `.../in/username`
 * - Query tracking parameters (`?trk=...`, `?utm_source=...`, `?originalSubdomain=...`) -> stripped
 * - Hash fragments (`#...`) -> stripped
 * - Standalone usernames (`username`, `@username`, `/in/username`) -> `https://www.linkedin.com/in/username`
 */
export function normalizeLinkedInUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';

  let trimmed = rawUrl.trim();
  if (!trimmed) return '';

  // 1. If user entered only an @username or username (e.g. "@johndoe" or "johndoe")
  if (/^@?[a-zA-Z0-9_\-–%]+$/.test(trimmed) && !trimmed.includes('.')) {
    const cleanHandle = trimmed.replace(/^@/, '');
    return `https://www.linkedin.com/in/${cleanHandle}`;
  }

  // 2. If starts with "/in/username"
  if (/^\/?in\/[a-zA-Z0-9_\-–%]+/i.test(trimmed)) {
    const handle = trimmed.replace(/^\/?in\//i, '').replace(/[/?#].*$/, '');
    return `https://www.linkedin.com/in/${handle}`;
  }

  // 3. Ensure protocol
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  } else if (/^http:\/\//i.test(trimmed)) {
    trimmed = trimmed.replace(/^http:\/\//i, 'https://');
  }

  try {
    const parsed = new URL(trimmed);

    // If hostname is a LinkedIn domain (e.g. in.linkedin.com, uk.linkedin.com, m.linkedin.com, linkedin.com)
    if (/linkedin\.com$/i.test(parsed.hostname)) {
      // Extract profile handle from pathname (e.g. /in/username, /in/username/, /pub/username)
      const pathSegments = parsed.pathname
        .split('/')
        .map((s) => s.trim())
        .filter(Boolean);

      let handle = '';
      if (pathSegments.length >= 2 && (pathSegments[0].toLowerCase() === 'in' || pathSegments[0].toLowerCase() === 'pub')) {
        handle = pathSegments[1];
      } else if (pathSegments.length === 1 && pathSegments[0].toLowerCase() !== 'in') {
        handle = pathSegments[0];
      }

      if (handle) {
        // Strip any trailing punctuation or slashes
        const cleanHandle = handle.replace(/[\/.]+$/, '');
        return `https://www.linkedin.com/in/${cleanHandle}`;
      }
    }

    // Fallback: strip query parameters, hash fragments, and trailing slash
    parsed.search = '';
    parsed.hash = '';
    let clean = parsed.toString().replace(/\/+$/, '');

    // Normalize subdomain to www.linkedin.com if on linkedin.com
    if (/linkedin\.com$/i.test(parsed.hostname)) {
      clean = clean.replace(/^https?:\/\/(?:[a-z]{2,3}\.|m\.)?linkedin\.com/i, 'https://www.linkedin.com');
    }

    return clean;
  } catch {
    // Regex fallback for non-standard URL strings
    const match = trimmed.match(/linkedin\.com\/in\/([a-zA-Z0-9_\-–%]+)/i);
    if (match && match[1]) {
      return `https://www.linkedin.com/in/${match[1]}`;
    }
    return trimmed;
  }
}

/**
 * Normalizes GitHub profile URLs to `https://github.com/<username>`
 */
export function normalizeGitHubUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let trimmed = rawUrl.trim();
  if (!trimmed) return '';

  if (/^@?[a-zA-Z0-9_-]+$/.test(trimmed) && !trimmed.includes('.')) {
    return `https://github.com/${trimmed.replace(/^@/, '')}`;
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }

  try {
    const parsed = new URL(trimmed);
    if (/github\.com$/i.test(parsed.hostname)) {
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length > 0) {
        return `https://github.com/${parts[0]}`;
      }
    }
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return trimmed;
  }
}

/**
 * Normalizes website/portfolio URLs by ensuring valid protocol and stripping trailing slashes.
 */
export function normalizePortfolioUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let trimmed = rawUrl.trim();
  if (!trimmed) return '';

  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return trimmed;
  }
}
