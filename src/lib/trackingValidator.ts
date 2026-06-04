// Daraz tracking number validator
// Real data बाट निकालिएका patterns (275 tracking analyzed):
//   DEXNP025527286  — 5 letters + 9 digits (DEXNP/UPANP) — 264 cases
//   PND-NP-000717568 — 3 letters - 2 letters - 9 digits — 8 cases

const VALID_PATTERNS = [
  /^[A-Z]{5}\d{9}$/,        // DEXNP025527286, UPANP000318133
  /^[A-Z]{3}-[A-Z]{2}-\d{9}$/, // PND-NP-000717568
];

// भविष्यमा नयाँ courier आए यहाँ pattern थप्न सकिन्छ

// QR / address detector. A real barcode tracking is a short, separator-free
// alphanumeric token. A QR scan returns the shipping ADDRESS: long text with
// spaces, commas, slashes, Devanagari, or other punctuation. This is used to
// HARD-block Force Add so a mis-scanned QR can never enter as a tracking,
// while still letting a genuinely new courier format through Force Add.
export function looksLikeQrOrAddress(input: string | null | undefined): boolean {
  if (!input) return false;
  const s = input.trim();
  if (/\s/.test(s)) return true;            // any whitespace
  if (/[,/\\;:|]/.test(s)) return true;      // address punctuation
  if (/[^\x00-\x7F]/.test(s)) return true;   // non-ASCII (e.g. Devanagari address)
  if (s.length > 25) return true;            // longer than any real tracking
  if (!/[A-Za-z0-9]/.test(s)) return true;   // no alphanumeric at all
  return false;
}

export interface TrackingValidation {
  valid: boolean;
  cleaned: string;
  reason?: string;
}

/**
 * Tracking number validate गर्ने।
 * @param input - raw scanned/typed tracking
 */
export function validateTracking(input: string | null | undefined): TrackingValidation {
  if (!input) return { valid: false, cleaned: "", reason: "खाली tracking number" };

  const cleaned = input.trim().toUpperCase();

  if (!cleaned) return { valid: false, cleaned: "", reason: "खाली tracking number" };

  // address वा extra text मिसिएको? (comma, space, slash संग)
  if (/[,/]/.test(cleaned) || cleaned.includes(" ")) {
    return { valid: false, cleaned, reason: "Tracking मा extra text/address मिसियो — सफा गरेर मात्र हाल्नुहोस्" };
  }

  for (const pattern of VALID_PATTERNS) {
    if (pattern.test(cleaned)) {
      return { valid: true, cleaned };
    }
  }

  return {
    valid: false,
    cleaned,
    reason: "Daraz standard format होइन (जस्तै DEXNP025527286 वा PND-NP-000717568)",
  };
}