// Frontend types matching backend types
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

export interface ProcessRequest {
  countyId: CountyId;
  inputs: Record<string, string>;
}

export interface ProcessResponse {
  success: boolean;
  results?: any[];
  error?: string;
}
