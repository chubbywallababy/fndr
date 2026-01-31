/**
 * Address extraction and scoring module
 * Extracts addresses from text and scores them by quality
 */

import { normalizeWhitespace, cleanForAddressExtraction } from '../document/text-normalizer';

export type AddressQuality = 'high' | 'medium' | 'low';

export interface ParsedAddress {
  raw: string;
  cleaned: string;
  score: number;
  quality: AddressQuality;
  isLikelyAddress: boolean;
  reasons: string[];
}

/**
 * Enhanced address regex patterns (extraction only, not validation)
 */
const ADDRESS_PATTERNS = [
  // Full address with city, state, zip
  /\d{1,6}\s+[A-Za-z0-9.\-\s]+?\s+(?:St\.?|Street|Ave\.?|Avenue|Rd\.?|Road|Blvd\.?|Boulevard|Ln\.?|Lane|Dr\.?|Drive|Ct\.?|Court|Way|Terrace|Pl\.?|Place|Circle|Cir\.?|Parkway|Pkwy\.?|Highway|Hwy\.?)(?:[\s,]+(?:Suite|Ste\.?|Unit|Apt\.?|#)\s*[A-Za-z0-9\-]+)?[\s,]+[A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?/gi,

  // Street only (no city/state)
  /\d{1,6}(?:-[A-Z])?\s+(?:North|South|East|West|N\.?|S\.?|E\.?|W\.?)?\s*[A-Za-z0-9.\-\s]+?\s+(?:St\.?|Street|Ave\.?|Avenue|Rd\.?|Road|Blvd\.?|Boulevard|Ln\.?|Lane|Dr\.?|Drive|Ct\.?|Court|Way|Terrace|Pl\.?|Place|Circle|Cir\.?|Parkway|Pkwy\.?|Highway|Hwy\.?)(?:[\s,]+(?:Suite|Ste\.?|Unit|Apt\.?|#)\s*[A-Za-z0-9\-]+)?/gi,
];

/* ============================================================
   Validation & scoring constants
   ============================================================ */

const STREET_TYPE_REGEX =
  /\b(st|street|rd|road|ave|avenue|blvd|boulevard|ln|lane|dr|drive|ct|court|way|terrace|pl|place|circle|cir|parkway|pkwy|highway|hwy)\b/i;

const CITY_REGEX = /\bLexington\b/i;
const STATE_REGEX = /\bKY\b|\bKentucky\b/i;
const ZIP_REGEX = /\b\d{5}(?:-\d{4})?\b/;

/**
 * Common false-positive phrases from legal / narrative text
 */
const NON_ADDRESS_PATTERNS = [
  /\bsouth of\b/i,
  /\bnorth of\b/i,
  /\beast of\b/i,
  /\bwest of\b/i,
  /\bcommonwealth\b/i,
  /\bcircuit court\b/i,
  /\bcase\b/i,
  /\bfiled\b/i,
  /\bplaintiff\b/i,
  /\bdefendant\b/i,
];

/**
 * Street number must appear near beginning
 */
const LEADING_NUMBER_REGEX = /^\s*\d{1,6}(\s|[A-Za-z])/;

/**
 * Cleans an extracted address string
 */
function cleanAddress(address: string): string {
  return cleanForAddressExtraction(address);
}

/**
 * Scores an extracted string and determines if it is likely an address
 */
export function scoreAddressCandidate(address: string): ParsedAddress {
  const cleaned = cleanAddress(address);
  const reasons: string[] = [];
  let score = 0;

  // Hard rejection for non-address phrases
  if (NON_ADDRESS_PATTERNS.some(r => r.test(cleaned))) {
    return {
      raw: address,
      cleaned,
      score: 0,
      quality: 'low',
      isLikelyAddress: false,
      reasons: ['matched_non_address_phrase'],
    };
  }

  // Leading street number (+40 points)
  if (LEADING_NUMBER_REGEX.test(cleaned)) {
    score += 40;
  } else {
    reasons.push('no_leading_street_number');
  }

  // Street type (+30 points)
  if (STREET_TYPE_REGEX.test(cleaned)) {
    score += 30;
  } else {
    reasons.push('no_street_type');
  }

  // City (+10 points)
  if (CITY_REGEX.test(cleaned)) score += 10;

  // State (+10 points)
  if (STATE_REGEX.test(cleaned)) score += 10;

  // Zip (+10 points)
  if (ZIP_REGEX.test(cleaned)) score += 10;

  let quality: AddressQuality = 'low';
  if (score >= 80) quality = 'high';
  else if (score >= 50) quality = 'medium';

  return {
    raw: address,
    cleaned,
    score,
    quality,
    isLikelyAddress: score >= 50,
    reasons,
  };
}

/**
 * Normalizes a ParsedAddress object's text fields
 */
function normalizeAddressText(addr: ParsedAddress): ParsedAddress {
  return {
    ...addr,
    raw: normalizeWhitespace(addr.raw),
    cleaned: normalizeWhitespace(addr.cleaned),
  };
}

/**
 * Extracts and validates addresses from text
 */
export function extractAddressesFromText(text: string): ParsedAddress[] {
  const normalizedText = normalizeWhitespace(text);
  const foundAddresses = new Set<string>();

  for (const pattern of ADDRESS_PATTERNS) {
    const matches = normalizedText.match(pattern);
    if (matches) {
      matches.forEach(match => foundAddresses.add(cleanAddress(match)));
    }
  }

  return Array.from(foundAddresses).map(scoreAddressCandidate);
}

/**
 * Filters out addresses that should be ignored
 */
export function filterIgnoredAddresses(
  addresses: ParsedAddress[],
  ignoreList?: string[]
): ParsedAddress[] {
  if (!ignoreList || ignoreList.length === 0) {
    return addresses;
  }
  
  const normalizedIgnoreList = ignoreList.map(addr => 
    normalizeWhitespace(cleanAddress(addr)).toLowerCase()
  );
  
  return addresses.filter((addr) => {
    const normalizedAddr = normalizeWhitespace(addr.cleaned).toLowerCase();
    return !normalizedIgnoreList.includes(normalizedAddr);
  });
}

/**
 * Gets the best address from a list (highest scoring)
 */
export function getBestAddress(addresses: ParsedAddress[]): ParsedAddress | null {
  if (addresses.length === 0) return null;
  
  return addresses.reduce((best, current) => 
    current.score > best.score ? current : best
  );
}
