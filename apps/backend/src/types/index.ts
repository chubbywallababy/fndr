// Shared types for backend inputs and configurations
// This library can be imported by both frontend and backend

// ============================================================
// Re-export types from modules
// ============================================================

// Parser types
export type {
  ParsedAddress,
  AddressQuality,
} from '../parsers/address-parser';

export type {
  PlaintiffInfo,
  DefendantInfo,
  PlaintiffType,
  DefendantType,
  LisPendensParseResult,
} from '../parsers/lis-pendens-parser';

// Classifier types
export type {
  LeadClassification,
  ClassifiedLead,
  LookupLinks,
  LevelScore,
  OverallScore,
  Level1Result,
  Level2Result,
  Level3Result,
  Level4Result,
} from '../classifiers/lead-classifier';

// Document types
export type {
  PdfReaderOptions,
  PdfReadResult,
} from '../document/pdf-reader';

// ============================================================
// Core types
// ============================================================

// County identifier types
export type CountyId = 'fayette-ky' | 'clark-nv';

// Input field configuration
export interface InputField {
  name: string;
  label: string;
  type: 'date' | 'text' | 'number' | 'select';
  required: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
}

// County configuration
export interface CountyConfig {
  id: CountyId;
  name: string;
  state: string;
  inputs: InputField[];
}

// ============================================================
// Shared processing options (used by all counties)
// ============================================================

/**
 * Options for PDF processing that can be shared across all county implementations
 */
export interface PdfProcessingOptions {
  /** If true, PDFs will be saved to disk instead of deleted after processing. Defaults to false. */
  savePdfs?: boolean;
  /** Directory to save PDFs to. Defaults to './saved-pdfs' */
  pdfOutputDir?: string;
}

/**
 * Base inputs interface that all county-specific inputs should extend
 */
export interface BaseCountyInputs extends PdfProcessingOptions {
  /** Optional array of addresses to ignore during processing */
  ignoreAddresses?: string[];
}

// County-specific input types
export interface FayetteInputs extends BaseCountyInputs {
  startDate: string; // Format: MM/DD/YYYY
  endDate: string; // Format: MM/DD/YYYY
  cookie?: string; // Optional session cookie
}

export interface ClarkInputs extends BaseCountyInputs {
  // Placeholder inputs - to be defined when implementing
  [key: string]: string | string[] | boolean | undefined;
}

// API request/response types
export interface ProcessRequest {
  countyId: CountyId;
  inputs: Record<string, string>;
}

export interface ProcessResponse {
  success: boolean;
  results?: any[];
  error?: string;
}

// County configurations
export const COUNTY_CONFIGS: Record<CountyId, CountyConfig> = {
  'fayette-ky': {
    id: 'fayette-ky',
    name: 'Fayette County',
    state: 'Kentucky',
    inputs: [
      {
        name: 'startDate',
        label: 'Start Date',
        type: 'date',
        required: true,
        placeholder: 'MM/DD/YYYY',
      },
      {
        name: 'endDate',
        label: 'End Date',
        type: 'date',
        required: true,
        placeholder: 'MM/DD/YYYY',
      },
      {
        name: 'cookie',
        label: 'Session Cookie (Optional)',
        type: 'text',
        required: false,
        placeholder: 'PHPSESSID=...',
      },
    ],
  },
  'clark-nv': {
    id: 'clark-nv',
    name: 'Clark County',
    state: 'Nevada',
    inputs: [
      {
        name: 'placeholder',
        label: 'Placeholder Field',
        type: 'text',
        required: false,
        placeholder: 'To be implemented',
      },
    ],
  },
};
