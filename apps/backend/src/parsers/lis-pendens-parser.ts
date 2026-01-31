/**
 * Lis Pendens document parser
 * Extracts Plaintiff, Defendant, and property information from legal documents
 */

import { normalizeWhitespace, normalizeForLegalParsing, extractBetweenMarkers } from '../document/text-normalizer';
import { extractAddressesFromText, ParsedAddress, getBestAddress } from './address-parser';

/* ============================================================
   Types
   ============================================================ */

export type PlaintiffType = 
  | 'bank' 
  | 'credit_union' 
  | 'mortgage_servicer' 
  | 'hoa' 
  | 'llc' 
  | 'government' 
  | 'individual' 
  | 'unknown';

export type DefendantType = 
  | 'individual' 
  | 'couple' 
  | 'trust' 
  | 'llc' 
  | 'unknown';

export interface PlaintiffInfo {
  name: string;
  type: PlaintiffType;
  isGoodLead: boolean;
  concerns: string[];
}

export interface DefendantInfo {
  name: string;
  type: DefendantType;
  isGoodLead: boolean;
  mailingAddress?: string;
}

export interface LisPendensParseResult {
  plaintiff: PlaintiffInfo;
  defendant: DefendantInfo;
  propertyAddress: ParsedAddress | null;
  mailingAddress: ParsedAddress | null;
  allAddresses: ParsedAddress[];
  rawText: string;
}

/* ============================================================
   Plaintiff Classification Patterns
   ============================================================ */

// Good plaintiff indicators (banks, lenders)
const GOOD_PLAINTIFF_PATTERNS = [
  /\bbank\b/i,
  /\bn\.?a\.?\b/i,  // National Association
  /\bfederal\s+credit\s+union\b/i,
  /\bcredit\s+union\b/i,
  /\bmortgage\b/i,
  /\blending\b/i,
  /\bloan\b/i,
  /\bfinancial\b/i,
  /\bservicing\b/i,
  /\btrustee\b/i,  // As plaintiff, often represents mortgage holder
  /\bwells\s+fargo\b/i,
  /\bchase\b/i,
  /\bcitibank\b/i,
  /\bbank\s+of\s+america\b/i,
  /\bpnc\b/i,
  /\bus\s+bank\b/i,
  /\bfifth\s+third\b/i,
  /\bfannie\s+mae\b/i,
  /\bfreddie\s+mac\b/i,
];

// Bad plaintiff indicators (HOA, government, service companies)
const BAD_PLAINTIFF_PATTERNS = [
  /\bhoa\b/i,
  /\bhomeowners?\s+association\b/i,
  /\bproperty\s+owners?\s+association\b/i,
  /\bcounty\b/i,
  /\bcity\s+of\b/i,
  /\bcommonwealth\b/i,
  /\bstate\s+of\b/i,
  /\bdemo(?:lition)?\b/i,
  /\bservice\s+llc\b/i,
  /\bconstruction\b/i,
  /\bcontract(?:or|ing)?\b/i,
  /\bplumbing\b/i,
  /\belectric(?:al)?\b/i,
  /\broofing\b/i,
  /\blandscap(?:e|ing)\b/i,
];

// Indicators for specific plaintiff types
const PLAINTIFF_TYPE_PATTERNS: { type: PlaintiffType; patterns: RegExp[] }[] = [
  { 
    type: 'bank', 
    patterns: [/\bbank\b/i, /\bn\.?a\.?\b/i, /\bwells\s+fargo\b/i, /\bchase\b/i, /\bcitibank\b/i, /\bpnc\b/i]
  },
  { 
    type: 'credit_union', 
    patterns: [/\bcredit\s+union\b/i, /\bfederal\s+credit\s+union\b/i, /\bfcu\b/i]
  },
  { 
    type: 'mortgage_servicer', 
    patterns: [/\bmortgage\b/i, /\bservicing\b/i, /\bloan\b/i]
  },
  { 
    type: 'hoa', 
    patterns: [/\bhoa\b/i, /\bhomeowners?\s+association\b/i, /\bproperty\s+owners?\s+association\b/i]
  },
  { 
    type: 'government', 
    patterns: [/\bcounty\b/i, /\bcity\s+of\b/i, /\bcommonwealth\b/i, /\bstate\s+of\b/i]
  },
  { 
    type: 'llc', 
    patterns: [/\bllc\b/i, /\bl\.l\.c\b/i]
  },
];

/* ============================================================
   Defendant Classification Patterns
   ============================================================ */

// Bad defendant indicators (business entities)
const BAD_DEFENDANT_PATTERNS = [
  /\bllc\b/i,
  /\bl\.l\.c\.?\b/i,
  /\binc\.?\b/i,
  /\bincorporated\b/i,
  /\bcorp\.?\b/i,
  /\bcorporation\b/i,
  /\bcompany\b/i,
  /\bco\.\b/i,
  /\blimited\s+partnership\b/i,
  /\blp\b/i,
  /\bltd\.?\b/i,
];

// Indicators for defendant types
const DEFENDANT_TYPE_PATTERNS: { type: DefendantType; patterns: RegExp[] }[] = [
  { 
    type: 'trust', 
    patterns: [/\btrust\b/i, /\btrustee\b/i, /\bas\s+trustee\b/i]
  },
  { 
    type: 'couple', 
    patterns: [/\band\b/i, /\s+&\s+/]  // "John and Jane Doe" or "John & Jane"
  },
  { 
    type: 'llc', 
    patterns: [/\bllc\b/i, /\bl\.l\.c\.?\b/i, /\binc\.?\b/i, /\bcorp\.?\b/i]
  },
];

/* ============================================================
   Extraction Functions
   ============================================================ */

/**
 * Extracts plaintiff name from Lis Pendens text
 */
function extractPlaintiffName(text: string): string {
  const normalizedText = normalizeForLegalParsing(text);
  
  // Common patterns for plaintiff section
  const patterns = [
    // "PLAINTIFF VS DEFENDANT" format
    /(?:^|\n)\s*([^\n]+?)\s*(?:,\s*)?(?:plaintiff|petitioner)/im,
    // "PLAINTIFF: Name" format
    /plaintiff[:\s]+([^\n,]+)/im,
    // "Name v. Name" format - take first part
    /([A-Z][A-Za-z\s,.]+?)\s+v\.?\s+/m,
    // Look for the VS section
    /([^\n]+?)\s+(?:vs?\.?|versus)\s+/im,
  ];
  
  for (const pattern of patterns) {
    const match = normalizedText.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim()
        .replace(/,?\s*plaintiff$/i, '')
        .replace(/^\s*re:\s*/i, '')
        .trim();
      if (name.length > 2 && name.length < 200) {
        return name;
      }
    }
  }
  
  return 'Unknown Plaintiff';
}

/**
 * Extracts defendant name from Lis Pendens text
 */
function extractDefendantName(text: string): string {
  const normalizedText = normalizeForLegalParsing(text);
  
  const patterns = [
    // "DEFENDANT" label
    /(?:^|\n)\s*([^\n]+?)\s*(?:,\s*)?(?:defendant|respondent)/im,
    // "DEFENDANT: Name" format
    /defendant[:\s]+([^\n,]+)/im,
    // "Name v. Name" format - take second part
    /\s+v\.?\s+([A-Z][A-Za-z\s,.]+?)(?:\n|,\s*(?:et|defendant))/im,
    // After VS
    /(?:vs?\.?|versus)\s+([^\n]+?)(?:\n|,\s*(?:et|defendant))/im,
  ];
  
  for (const pattern of patterns) {
    const match = normalizedText.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim()
        .replace(/,?\s*defendant$/i, '')
        .replace(/,?\s*et\s+al\.?$/i, '')
        .trim();
      if (name.length > 2 && name.length < 200) {
        return name;
      }
    }
  }
  
  return 'Unknown Defendant';
}

/**
 * Classifies plaintiff and determines if it's a good lead
 */
function classifyPlaintiff(name: string, fullText: string): PlaintiffInfo {
  const concerns: string[] = [];
  
  // Check for multiple plaintiffs (potential second mortgage)
  const vsSection = fullText.match(/(.+?)(?:vs?\.?|versus)/is)?.[1] || '';
  if (/\band\b/i.test(vsSection) || /\s+&\s+/.test(vsSection)) {
    // Check if it's multiple banks/lenders
    const parts = vsSection.split(/\band\b|\s+&\s+/i);
    const bankCount = parts.filter(p => 
      GOOD_PLAINTIFF_PATTERNS.some(pattern => pattern.test(p))
    ).length;
    if (bankCount > 1) {
      concerns.push('Multiple plaintiffs - potential second mortgage');
    }
  }
  
  // Determine plaintiff type
  let type: PlaintiffType = 'unknown';
  for (const { type: pType, patterns } of PLAINTIFF_TYPE_PATTERNS) {
    if (patterns.some(p => p.test(name))) {
      type = pType;
      break;
    }
  }
  
  // If still unknown but matches individual pattern (no business indicators)
  if (type === 'unknown' && !BAD_PLAINTIFF_PATTERNS.some(p => p.test(name))) {
    // Check if it looks like a person's name (First Last or Last, First)
    if (/^[A-Z][a-z]+\s+[A-Z][a-z]+/.test(name) || /^[A-Z][a-z]+,\s*[A-Z][a-z]+/.test(name)) {
      type = 'individual';
    }
  }
  
  // Determine if good lead based on patterns
  const isGoodPlaintiff = GOOD_PLAINTIFF_PATTERNS.some(p => p.test(name));
  const isBadPlaintiff = BAD_PLAINTIFF_PATTERNS.some(p => p.test(name));
  
  return {
    name: normalizeWhitespace(name),
    type,
    isGoodLead: isGoodPlaintiff && !isBadPlaintiff,
    concerns,
  };
}

/**
 * Classifies defendant and determines if it's a good lead
 */
function classifyDefendant(name: string, fullText: string): DefendantInfo {
  // Determine defendant type
  let type: DefendantType = 'unknown';
  for (const { type: dType, patterns } of DEFENDANT_TYPE_PATTERNS) {
    if (patterns.some(p => p.test(name))) {
      type = dType;
      break;
    }
  }
  
  // If unknown and no bad patterns, likely individual
  if (type === 'unknown' && !BAD_DEFENDANT_PATTERNS.some(p => p.test(name))) {
    type = 'individual';
  }
  
  // Try to extract mailing address if different from property
  // Look for patterns like "residing at" or "whose address is"
  let mailingAddress: string | undefined;
  const mailingPatterns = [
    /(?:residing|resides|lives?)\s+at\s+([^\n]+)/i,
    /(?:whose|their)\s+(?:mailing\s+)?address\s+is\s+([^\n]+)/i,
    /mailing\s+address[:\s]+([^\n]+)/i,
  ];
  
  for (const pattern of mailingPatterns) {
    const match = fullText.match(pattern);
    if (match && match[1]) {
      mailingAddress = normalizeWhitespace(match[1]);
      break;
    }
  }
  
  // Determine if good lead (not a business entity)
  const isBadDefendant = BAD_DEFENDANT_PATTERNS.some(p => p.test(name));
  
  return {
    name: normalizeWhitespace(name),
    type,
    isGoodLead: !isBadDefendant,
    mailingAddress,
  };
}

/**
 * Parses a Lis Pendens document and extracts all relevant information
 */
export function parseLisPendens(text: string): LisPendensParseResult {
  const normalizedText = normalizeForLegalParsing(text);
  
  // Extract plaintiff and defendant names
  const plaintiffName = extractPlaintiffName(normalizedText);
  const defendantName = extractDefendantName(normalizedText);
  
  // Classify them
  const plaintiff = classifyPlaintiff(plaintiffName, normalizedText);
  const defendant = classifyDefendant(defendantName, normalizedText);
  
  // Extract all addresses
  const allAddresses = extractAddressesFromText(normalizedText);
  
  // Try to identify property address (usually the highest scoring one)
  const propertyAddress = getBestAddress(allAddresses);
  
  // Try to find a separate mailing address
  let mailingAddress: ParsedAddress | null = null;
  if (defendant.mailingAddress) {
    const mailingAddresses = extractAddressesFromText(defendant.mailingAddress);
    mailingAddress = getBestAddress(mailingAddresses);
  }
  
  // If we have multiple addresses, the second-best might be mailing address
  if (!mailingAddress && allAddresses.length > 1) {
    const sortedAddresses = [...allAddresses].sort((a, b) => b.score - a.score);
    if (sortedAddresses.length >= 2 && sortedAddresses[0].cleaned !== sortedAddresses[1].cleaned) {
      mailingAddress = sortedAddresses[1];
    }
  }
  
  return {
    plaintiff,
    defendant,
    propertyAddress,
    mailingAddress,
    allAddresses,
    rawText: text,
  };
}

/**
 * Quick check if a plaintiff name indicates a good lead
 */
export function isGoodPlaintiff(name: string): boolean {
  const isGood = GOOD_PLAINTIFF_PATTERNS.some(p => p.test(name));
  const isBad = BAD_PLAINTIFF_PATTERNS.some(p => p.test(name));
  return isGood && !isBad;
}

/**
 * Quick check if a defendant name indicates a good lead
 */
export function isGoodDefendant(name: string): boolean {
  return !BAD_DEFENDANT_PATTERNS.some(p => p.test(name));
}
