// County configuration types
export type CountyId = 'fayette-ky' | 'clark-nv';

export interface CountyConfig {
  id: CountyId;
  name: string;
  state: string;
  inputs: InputField[];
}

export interface InputField {
  name: string;
  label: string;
  type: 'date' | 'text' | 'number' | 'select';
  required: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
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

export interface ProcessRequest {
  countyId: CountyId;
  inputs: Record<string, string>;
}

export interface ProcessResponse {
  success: boolean;
  results?: any[];
  error?: string;
}
