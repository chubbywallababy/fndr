/**
 * Lead Classifier
 * Implements 4-level scoring system for Lis Pendens leads
 * 
 * Level 1: Plaintiff analysis (Bank/Lender = Good, HOA/LLC/Government = Bad)
 * Level 2: Defendant analysis (Individual/Family = Good, LLC = Bad)
 * Level 3: Equity/Purchase Date (5+ years = Good, <5 years = Bad) - requires external lookup
 * Level 4: Property Quality (B- neighborhood, 3-5 beds = Good) - requires external lookup
 */

import { 
  LisPendensParseResult, 
  PlaintiffInfo, 
  DefendantInfo 
} from '../parsers/lis-pendens-parser';
import { ParsedAddress } from '../parsers/address-parser';

/* ============================================================
   Types
   ============================================================ */

export type LevelScore = 'good' | 'bad' | 'unknown' | 'needs_lookup';
export type OverallScore = 'good' | 'review' | 'bad';

export interface Level1Result {
  score: LevelScore;
  plaintiff: PlaintiffInfo;
  note: string;
}

export interface Level2Result {
  score: LevelScore;
  defendant: DefendantInfo;
  note: string;
}

export interface Level3Result {
  score: LevelScore;
  note: string;
  purchaseDate?: Date;
  yearsOwned?: number;
}

export interface Level4Result {
  score: LevelScore;
  note: string;
  neighborhoodGrade?: string;
  bedCount?: number;
  bathCount?: number;
}

export interface LeadClassification {
  level1: Level1Result;
  level2: Level2Result;
  level3: Level3Result;
  level4: Level4Result;
  overallScore: OverallScore;
  stopReason?: string;
  concerns: string[];
}

export interface ClassifiedLead {
  id: string;
  pdfUrl?: string;
  propertyAddress: ParsedAddress | null;
  mailingAddress: ParsedAddress | null;
  plaintiff: PlaintiffInfo;
  defendant: DefendantInfo;
  classification: LeadClassification;
  lookupLinks: LookupLinks;
  rawText?: string;
}

export interface LookupLinks {
  pva: string;
  zillow: string;
  googleMaps: string;
}

/* ============================================================
   Link Generation
   ============================================================ */

const FAYETTE_PVA_BASE = 'https://fayettepva.com/property-search';
const ZILLOW_BASE = 'https://www.zillow.com/homes';
const GOOGLE_MAPS_BASE = 'https://www.google.com/maps/search';

/**
 * Generates lookup links for external data sources
 */
export function generateLookupLinks(
  address: ParsedAddress | null,
  defendantName: string
): LookupLinks {
  const encodedName = encodeURIComponent(defendantName);
  const encodedAddress = address 
    ? encodeURIComponent(address.cleaned)
    : '';
  
  return {
    pva: `${FAYETTE_PVA_BASE}?owner=${encodedName}`,
    zillow: address ? `${ZILLOW_BASE}/${encodedAddress}_rb/` : `${ZILLOW_BASE}/?searchQueryState={"usersSearchTerm":"${encodedName}"}`,
    googleMaps: address ? `${GOOGLE_MAPS_BASE}/${encodedAddress}` : `${GOOGLE_MAPS_BASE}/${encodedName}`,
  };
}

/* ============================================================
   Level Classification Functions
   ============================================================ */

/**
 * Level 1: Classify based on Plaintiff
 * Good: Bank, Lender, Credit Union, Mortgage Servicer
 * Bad: HOA, Service LLC, Government/County/City
 */
function classifyLevel1(plaintiff: PlaintiffInfo): Level1Result {
  let score: LevelScore = 'unknown';
  let note = '';
  
  if (plaintiff.isGoodLead) {
    score = 'good';
    note = `${plaintiff.type} plaintiff (likely lender)`;
  } else {
    switch (plaintiff.type) {
      case 'hoa':
        score = 'bad';
        note = 'HOA plaintiff - not a foreclosure';
        break;
      case 'government':
        score = 'bad';
        note = 'Government plaintiff - likely tax or code enforcement';
        break;
      case 'llc':
        score = 'bad';
        note = 'LLC plaintiff - likely service/contractor lien';
        break;
      case 'unknown':
        score = 'unknown';
        note = 'Unable to determine plaintiff type';
        break;
      default:
        score = 'unknown';
        note = `Plaintiff type: ${plaintiff.type}`;
    }
  }
  
  return { score, plaintiff, note };
}

/**
 * Level 2: Classify based on Defendant/Owner
 * Good: Individual, Couple, Family, Trust
 * Bad: LLC, Corporation, Business entity
 */
function classifyLevel2(defendant: DefendantInfo): Level2Result {
  let score: LevelScore = 'unknown';
  let note = '';
  
  if (defendant.isGoodLead) {
    score = 'good';
    switch (defendant.type) {
      case 'individual':
        note = 'Individual owner';
        break;
      case 'couple':
        note = 'Couple/family owners';
        break;
      case 'trust':
        note = 'Trust ownership (may need extra review)';
        break;
      default:
        note = 'Owner appears to be an individual';
    }
  } else {
    score = 'bad';
    note = defendant.type === 'llc' 
      ? 'LLC/Business owner - not a personal residence'
      : 'Business entity owner';
  }
  
  return { score, defendant, note };
}

/**
 * Level 3: Classify based on Equity Position
 * Good: 5+ years of ownership
 * Bad: Less than 5 years
 * 
 * Note: This requires external data (PVA) - returns 'needs_lookup' by default
 */
function classifyLevel3(purchaseDate?: Date): Level3Result {
  if (!purchaseDate) {
    return {
      score: 'needs_lookup' as LevelScore,
      note: 'Purchase date requires PVA lookup',
    };
  }
  
  const now = new Date();
  const yearsOwned = (now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
  
  if (yearsOwned >= 5) {
    return {
      score: 'good' as LevelScore,
      note: `${Math.floor(yearsOwned)} years of ownership - good equity potential`,
      purchaseDate,
      yearsOwned,
    };
  } else {
    return {
      score: 'bad' as LevelScore,
      note: `Only ${Math.floor(yearsOwned)} years of ownership - limited equity`,
      purchaseDate,
      yearsOwned,
    };
  }
}

/**
 * Level 4: Classify based on Property Quality
 * Good: B- or better neighborhood, 3-5 bedrooms
 * Bad: C+ or worse neighborhood
 * 
 * Note: This requires external data (Zillow/PVA) - returns 'needs_lookup' by default
 */
function classifyLevel4(
  neighborhoodGrade?: string,
  bedCount?: number
): Level4Result {
  if (!neighborhoodGrade && !bedCount) {
    return {
      score: 'needs_lookup' as LevelScore,
      note: 'Property details require Zillow/PVA lookup',
    };
  }
  
  let score: LevelScore = 'unknown';
  const notes: string[] = [];
  
  // Check neighborhood grade
  if (neighborhoodGrade) {
    const grade = neighborhoodGrade.toUpperCase();
    const goodGrades = ['A+', 'A', 'A-', 'B+', 'B', 'B-'];
    const badGrades = ['C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'];
    
    if (goodGrades.includes(grade)) {
      score = 'good';
      notes.push(`${grade} neighborhood`);
    } else if (badGrades.includes(grade)) {
      score = 'bad';
      notes.push(`${grade} neighborhood - below threshold`);
    }
  }
  
  // Check bed count
  if (bedCount !== undefined) {
    if (bedCount >= 3 && bedCount <= 5) {
      if (score !== 'bad') score = 'good';
      notes.push(`${bedCount} bedrooms`);
    } else if (bedCount < 3) {
      notes.push(`Only ${bedCount} bedrooms`);
    } else {
      notes.push(`${bedCount} bedrooms (larger property)`);
    }
  }
  
  const finalScore: LevelScore = score === 'unknown' ? 'needs_lookup' : score;
  
  return {
    score: finalScore,
    note: notes.join(', ') || 'Partial property data available',
    neighborhoodGrade,
    bedCount,
  };
}

/* ============================================================
   Main Classification Function
   ============================================================ */

/**
 * Classifies a Lis Pendens lead using the 4-level system
 * Returns early if Level 1 or Level 2 is "bad" (stop reason)
 */
export function classifyLead(
  parseResult: LisPendensParseResult,
  externalData?: {
    purchaseDate?: Date;
    neighborhoodGrade?: string;
    bedCount?: number;
    bathCount?: number;
  }
): LeadClassification {
  const concerns: string[] = [...parseResult.plaintiff.concerns];
  
  // Level 1: Plaintiff classification
  const level1 = classifyLevel1(parseResult.plaintiff);
  
  // Early termination if Level 1 is bad
  if (level1.score === 'bad') {
    return {
      level1,
      level2: { 
        score: 'unknown', 
        defendant: parseResult.defendant, 
        note: 'Skipped - Level 1 failed' 
      },
      level3: { score: 'unknown', note: 'Skipped - Level 1 failed' },
      level4: { score: 'unknown', note: 'Skipped - Level 1 failed' },
      overallScore: 'bad',
      stopReason: `Level 1: ${level1.note}`,
      concerns,
    };
  }
  
  // Level 2: Defendant classification
  const level2 = classifyLevel2(parseResult.defendant);
  
  // Early termination if Level 2 is bad
  if (level2.score === 'bad') {
    return {
      level1,
      level2,
      level3: { score: 'unknown', note: 'Skipped - Level 2 failed' },
      level4: { score: 'unknown', note: 'Skipped - Level 2 failed' },
      overallScore: 'bad',
      stopReason: `Level 2: ${level2.note}`,
      concerns,
    };
  }
  
  // Level 3: Equity position (requires external data)
  const level3 = classifyLevel3(externalData?.purchaseDate);
  
  // Level 4: Property quality (requires external data)
  const level4 = classifyLevel4(
    externalData?.neighborhoodGrade,
    externalData?.bedCount
  );
  if (externalData?.bathCount) {
    level4.bathCount = externalData.bathCount;
  }
  
  // Determine overall score
  let overallScore: OverallScore = 'good';
  
  if (
    level1.score === 'unknown' || 
    level2.score === 'unknown' ||
    level3.score === 'needs_lookup' ||
    level4.score === 'needs_lookup' ||
    level3.score === 'unknown' ||
    level4.score === 'unknown'
  ) {
    overallScore = 'review';
  } else if (level3.score !== 'good' || level4.score !== 'good') {
    // Levels 3 & 4 not being "good" means they need review
    overallScore = 'review';
    if (level3.score !== 'good') concerns.push('Limited equity position');
    if (level4.score !== 'good') concerns.push('Property quality concerns');
  }
  
  return {
    level1,
    level2,
    level3,
    level4,
    overallScore,
    concerns,
  };
}

/**
 * Creates a fully classified lead with all metadata
 */
export function createClassifiedLead(
  id: string,
  pdfUrl: string | undefined,
  parseResult: LisPendensParseResult,
  externalData?: {
    purchaseDate?: Date;
    neighborhoodGrade?: string;
    bedCount?: number;
    bathCount?: number;
  },
  includeRawText = false
): ClassifiedLead {
  const classification = classifyLead(parseResult, externalData);
  const lookupLinks = generateLookupLinks(
    parseResult.propertyAddress,
    parseResult.defendant.name
  );
  
  return {
    id,
    pdfUrl,
    propertyAddress: parseResult.propertyAddress,
    mailingAddress: parseResult.mailingAddress,
    plaintiff: parseResult.plaintiff,
    defendant: parseResult.defendant,
    classification,
    lookupLinks,
    rawText: includeRawText ? parseResult.rawText : undefined,
  };
}
