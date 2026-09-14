/**
 * Security and Hardening Utilities for QuickFiller
 * Covers SSRF defense, secret redaction, and input validation.
 */

// Private IPv4 regex patterns: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, 169.254.0.0/16, 0.0.0.0/8
const PRIVATE_IPV4_REGEX = /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|169\.254\.\d{1,3}\.\d{1,3}|0\.0\.0\.0)$/;

/**
 * Validates whether a URL is safe for external fetching by the background service worker.
 * Prevents SSRF attacks against internal infrastructure, localhost services, and cloud metadata endpoints.
 */
export function isSafeExternalUrl(rawUrl: string): { safe: boolean; error?: string; url?: URL } {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { safe: false, error: 'Empty or invalid URL provided' };
  }

  const trimmed = rawUrl.trim();

  // 1. Explicitly reject non-HTTP schemes (e.g. file:, javascript:, data:, ftp:)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    if (!trimmed.toLowerCase().startsWith('http://') && !trimmed.toLowerCase().startsWith('https://')) {
      return { safe: false, error: 'Disallowed protocol. Only HTTP and HTTPS are permitted.' };
    }
  }

  let parsed: URL;
  try {
    const withProto = trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `https://${trimmed}`;
    parsed = new URL(withProto);
  } catch {
    return { safe: false, error: 'Malformed URL format' };
  }

  // Double check protocol
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { safe: false, error: `Disallowed protocol: ${parsed.protocol}. Only HTTP and HTTPS are permitted.` };
  }

  const hostname = parsed.hostname.toLowerCase().trim();

  // 2. Reject loopback and local hostnames
  if (
    !hostname ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === '::1' ||
    hostname === '[::1]'
  ) {
    return { safe: false, error: 'Access to localhost and internal network domains is restricted.' };
  }

  // 3. Reject private and link-local IP addresses (SSRF / Cloud Metadata)
  const ipMatch = hostname.replace(/^\[|\]$/g, '');
  if (PRIVATE_IPV4_REGEX.test(ipMatch)) {
    return { safe: false, error: 'Access to private and cloud metadata IP addresses is restricted.' };
  }

  // 4. Reject IPv6 loopback, unique-local, and link-local
  if (
    ipMatch === '::1' ||
    ipMatch.startsWith('fc00:') ||
    ipMatch.startsWith('fd00:') ||
    ipMatch.startsWith('fe80:')
  ) {
    return { safe: false, error: 'Access to private IPv6 addresses is restricted.' };
  }

  return { safe: true, url: parsed };
}

/**
 * Redacts sensitive API keys and tokens from error messages and logs.
 */
export function redactSecrets(text: string, secrets: (string | undefined)[] = []): string {
  if (!text || typeof text !== 'string') return text || '';
  let sanitized = text;

  // Redact explicit secret strings passed in
  for (const s of secrets) {
    if (s && typeof s === 'string' && s.length >= 6) {
      sanitized = sanitized.replaceAll(s, '[REDACTED_SECRET]');
    }
  }

  // Redact URL query parameter keys (e.g. ?key=AIzaSy... or &api_key=...)
  sanitized = sanitized.replace(/([?&](?:key|api_key|token|access_token|apikey)=)[^&\s]+/gi, '$1[REDACTED_KEY]');

  // Redact auth header tokens
  const bearerRegex = new RegExp('(?:' + 'Bearer' + '\\s+)[a-zA-Z0-9_\\-\\.]' + '{8,}', 'gi');
  sanitized = sanitized.replace(bearerRegex, 'Bearer [REDACTED_TOKEN]');

  return sanitized;
}

/**
 * Validates PDF file buffer for size and magic byte header before parsing.
 */
export function validatePdfBuffer(
  buffer: ArrayBuffer,
  maxSizeBytes = 10 * 1024 * 1024 // 10MB default
): { valid: boolean; error?: string } {
  if (!buffer || !(buffer instanceof ArrayBuffer)) {
    return { valid: false, error: 'Invalid file buffer' };
  }

  if (buffer.byteLength === 0) {
    return { valid: false, error: 'File is empty (0 bytes)' };
  }

  if (buffer.byteLength > maxSizeBytes) {
    const sizeMb = (buffer.byteLength / (1024 * 1024)).toFixed(1);
    const limitMb = (maxSizeBytes / (1024 * 1024)).toFixed(0);
    return { valid: false, error: `File too large (${sizeMb}MB). Maximum allowed size is ${limitMb}MB.` };
  }

  // Verify PDF Magic Bytes: %PDF- (hex: 25 50 44 46 2D)
  if (buffer.byteLength < 5) {
    return { valid: false, error: 'Corrupt or invalid PDF file header' };
  }

  const bytes = new Uint8Array(buffer, 0, 5);
  const isPdf =
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 && // F
    bytes[4] === 0x2d;   // -

  if (!isPdf) {
    return { valid: false, error: 'Selected file is not a valid PDF document (missing %PDF- header).' };
  }

  return { valid: true };
}

/**
 * Validates whether a URL is safe to bind to an anchor tag `href` attribute.
 * Allows 'http:', 'https:', 'mailto:', and local 'file:' URLs.
 * Rejects dangerous pseudo-schemes such as 'javascript:', 'data:', 'vbscript:', 'blob:'.
 */
export function isSafeWebUrl(rawUrl: string | undefined | null): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;

  // Reject control characters and invisible unicode characters
  if (/[\u0000-\u001F\u007F-\u009F]/.test(trimmed)) {
    return false;
  }

  // Reject javascript:, data:, vbscript:, blob: (case-insensitive, whitespace/tab normalized)
  const normalized = trimmed.replace(/\s+/g, '').toLowerCase();
  if (
    normalized.startsWith('javascript:') ||
    normalized.startsWith('data:') ||
    normalized.startsWith('vbscript:') ||
    normalized.startsWith('blob:')
  ) {
    return false;
  }

  try {
    const withProto = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)
      ? trimmed
      : trimmed.startsWith('//')
      ? `https:${trimmed}`
      : `https://${trimmed}`;
    const parsed = new URL(withProto);
    const proto = parsed.protocol.toLowerCase();
    return proto === 'http:' || proto === 'https:' || proto === 'mailto:' || proto === 'file:';
  } catch {
    return false;
  }
}

/**
 * Sanitizes a URL string for safe anchor href rendering.
 * Returns the sanitized URL string, or fallback (default: '#') if unsafe.
 */
export function sanitizeWebUrl(rawUrl: string | undefined | null, fallback: string = '#'): string {
  if (!rawUrl || typeof rawUrl !== 'string') return fallback;
  const trimmed = rawUrl.trim();
  if (!isSafeWebUrl(trimmed)) return fallback;

  try {
    const withProto = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)
      ? trimmed
      : trimmed.startsWith('//')
      ? `https:${trimmed}`
      : `https://${trimmed}`;
    return new URL(withProto).toString();
  } catch {
    return fallback;
  }
}
