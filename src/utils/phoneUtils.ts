/**
 * Phone and Extension Utility Engine
 * Provides robust extraction, decoupling, and sanitization of phone numbers
 * and phone extensions across various international and ATS formats.
 */

export interface PhoneParts {
  phone: string;
  extension: string;
}

/**
 * Splits a raw phone number string into clean base phone number and extension.
 *
 * Supported extension formats:
 * - "+1 (555) 123-4567 ext. 101" -> phone: "+1 (555) 123-4567", extension: "101"
 * - "(123) 456-7890 x42" -> phone: "(123) 456-7890", extension: "42"
 * - "9876543210 ext 12" -> phone: "9876543210", extension: "12"
 * - "+91 9876543210, ext. 456" -> phone: "+91 9876543210", extension: "456"
 * - "+1 (800) 555-0199 extension 999" -> phone: "+1 (800) 555-0199", extension: "999"
 * - "555-123-4567 #101" -> phone: "555-123-4567", extension: "101"
 * - "1234567890" -> phone: "1234567890", extension: ""
 */
export function splitPhoneAndExtension(rawPhone: string): PhoneParts {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return { phone: '', extension: '' };
  }

  const trimmed = rawPhone.trim();
  if (!trimmed) {
    return { phone: '', extension: '' };
  }

  // Regex matches:
  // Preceded by whitespace, comma, semicolon, or hyphen:
  // "ext", "ext.", "ext:", "extension", "extension:", "x", "x.", "x:", "#"
  // followed by 1 to 8 digits / alphanumeric code
  const extRegex = /(?:[,\s-]+|^)(?:ext(?:ension)?|x|#)\s*[:.]?\s*([0-9a-zA-Z]+)\b/i;
  const match = trimmed.match(extRegex);

  if (match && match.index !== undefined) {
    const extension = (match[1] || '').trim();
    const phone = trimmed.slice(0, match.index).replace(/[,;\s-]+$/, '').trim();
    return { phone, extension };
  }

  return { phone: trimmed, extension: '' };
}

/**
 * Returns clean base phone number stripped of any extension suffix.
 */
export function cleanPhoneNumber(rawPhone: string): string {
  return splitPhoneAndExtension(rawPhone).phone;
}

/**
 * Extracts and returns the extension digits/code if present, or empty string.
 */
export function extractPhoneExtension(rawPhone: string): string {
  return splitPhoneAndExtension(rawPhone).extension;
}
