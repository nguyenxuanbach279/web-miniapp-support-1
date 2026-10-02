export function extractPhoneNumbers(input: string): string[] {
  if (!input) return [];

  // Match pattern for:
  // 1. +84xxxxxxxxx or +84 xxxxxxxxx
  // 2. 0xxxxxxxxx or 0xxxxxxxxx
  // 3. 9xxxxxxxxx (missing leading 0)
  const regex = /(?:\+84\d{9,10}|84\d{9,10}|0\d{9,10}|\b[35789]\d{8}\b)/g;
  const matches = input.match(regex) || [];

  const normalized = matches.map(match => {
    const cleaned = match.replace(/\s+/g, '');
    if (cleaned.startsWith('+84')) {
      return cleaned;
    }
    if (cleaned.startsWith('84') && cleaned.length >= 11) {
      return '+' + cleaned;
    }
    if (cleaned.length === 9 && ['3', '5', '7', '8', '9'].includes(cleaned[0])) {
      return '0' + cleaned;
    }
    return cleaned;
  });

  return Array.from(new Set(normalized));
}

export function extractPrimaryPhoneNumber(input: string): string | null {
  const list = extractPhoneNumbers(input);
  return list.length > 0 ? list[0] : null;
}

export function extractAllPhoneNumbers(input: string): string | null {
  const list = extractPhoneNumbers(input);
  return list.length > 0 ? list.join(', ') : null;
}

/**
 * Normalizes any phone number into canonical 10-digit Vietnamese format (e.g., 0972390426).
 * Handles +84, 84, leading zero omissions, dots, dashes, and spaces.
 */
export function normalizeCanonicalPhone(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.trim().replace(/[\s\.\-\(\)]/g, '');
  if (cleaned.startsWith('+84')) {
    cleaned = '0' + cleaned.substring(3);
  } else if (cleaned.startsWith('84') && cleaned.length >= 11) {
    cleaned = '0' + cleaned.substring(2);
  } else if (cleaned.length === 9 && ['3', '5', '7', '8', '9'].includes(cleaned[0])) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
}

/**
 * Parses multiple phone numbers separated by comma, newline, semicolon, or spaces.
 * Validates each number and returns unique canonical phone strings.
 */
export function parseMultiplePhoneNumbers(input: string): string[] {
  if (!input) return [];

  // Split by newline, comma, semicolon
  const rawParts = input.split(/[\n,;]+/);
  const results: string[] = [];

  for (const part of rawParts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // Check if the part has phone numbers extracted by regex
    const extracted = extractPhoneNumbers(trimmed);
    if (extracted.length > 0) {
      for (const ph of extracted) {
        const canonical = normalizeCanonicalPhone(ph);
        if (canonical && isValidPhoneNumber(canonical)) {
          results.push(canonical);
        }
      }
    } else {
      // Direct cleanup & validation
      const canonical = normalizeCanonicalPhone(trimmed);
      if (canonical && isValidPhoneNumber(canonical)) {
        results.push(canonical);
      }
    }
  }

  return Array.from(new Set(results));
}

/**
 * Checks if a string looks like a valid phone number (10-11 digits, standard VN prefixes).
 */
export function isValidPhoneNumber(phone: string): boolean {
  if (!phone) return false;
  const canonical = normalizeCanonicalPhone(phone);
  // Vietnamese standard numbers: 10 digits starting with 03, 05, 07, 08, 09
  // or 10-11 digits general phone number
  return /^0[1-9]\d{8,9}$/.test(canonical);
}
