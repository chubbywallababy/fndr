// Shared types for backend inputs and configurations
// This library can be imported by both frontend and backend

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

// County-specific input types
export interface FayetteInputs {
  startDate: string; // Format: MM/DD/YYYY
  endDate: string; // Format: MM/DD/YYYY
  cookie?: string; // Optional session cookie
  ignoreAddresses?: string[]; // Optional array of addresses to ignore
}

export interface ClarkInputs {
  // Placeholder inputs - to be defined when implementing
  [key: string]: string;
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
