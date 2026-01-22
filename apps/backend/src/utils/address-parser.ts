// Polyfill for pdfjs-dist in Node.js environment
if (typeof DOMMatrix === 'undefined') {
  global.DOMMatrix = require('canvas').DOMMatrix;
}

import axios, { AxiosRequestConfig } from 'axios';
import fs from 'fs';
// Use require for CommonJS module compatibility with pdf-parse
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse: (buffer: Buffer) => Promise<{ text: string }> = require('pdf-parse');

export interface AddressParserOptions {
  /**
   * Array of addresses to ignore/filter out from results
   */
  ignoreAddresses?: string[];
  /**
   * Axios request configuration for authenticated requests (headers, cookies, etc.)
   * Only used when parsing from URL
   */
  axiosConfig?: AxiosRequestConfig;
}

/**
 * Address regex pattern to match common US address formats
 */
const ADDRESS_REGEX = /\d{1,6}\s+[A-Za-z0-9.\- ]+\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Ln|Lane|Dr|Drive|Ct|Court|Way|Terrace|Pl|Place|Circle|Cir)\b/g;

/**
 * Normalizes an address string for comparison (lowercase, trim, normalize spaces)
 */
function normalizeAddress(address: string): string {
  return address.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Filters out addresses that should be ignored
 */
function filterIgnoredAddresses(
  addresses: string[],
  ignoreList?: string[]
): string[] {
  if (!ignoreList || ignoreList.length === 0) {
    return addresses;
  }

  const normalizedIgnoreList = ignoreList.map(normalizeAddress);
  return addresses.filter((addr) => {
    const normalized = normalizeAddress(addr);
    return !normalizedIgnoreList.includes(normalized);
  });
}

/**
 * Extracts addresses from PDF text content
 */
function extractAddressesFromText(text: string): string[] {
  const matches = text.match(ADDRESS_REGEX);
  if (!matches) {
    return [];
  }

  // Remove duplicates and trim
  const uniqueAddresses = [...new Set(matches.map((addr) => addr.trim()))];
  return uniqueAddresses;
}

/**
 * Parses addresses from a remote PDF URL
 * 
 * @param url - The URL of the PDF to parse
 * @param options - Optional configuration including addresses to ignore and axios config for authentication
 * @returns Promise resolving to an array of unique addresses found in the PDF
 * 
 * @example
 * ```typescript
 * // Simple URL parsing
 * const addresses = await parseAddressesFromUrl('https://example.com/document.pdf', {
 *   ignoreAddresses: ['123 Main St', '456 Oak Ave']
 * });
 * 
 * // With authentication
 * const addresses = await parseAddressesFromUrl('https://example.com/document.pdf', {
 *   ignoreAddresses: ['123 Main St'],
 *   axiosConfig: {
 *     headers: { Cookie: 'PHPSESSID=...' }
 *   }
 * });
 * ```
 */
export async function parseAddressesFromUrl(
  url: string,
  options: AddressParserOptions = {}
): Promise<string[]> {
  try {
    // If axios config is provided (for authentication), download first then parse
    if (options.axiosConfig) {
      const pdfResp = await axios.get(url, {
        ...options.axiosConfig,
        responseType: 'arraybuffer',
      });
      const pdfData = await pdfParse(Buffer.from(pdfResp.data));
      const text = pdfData.text;
      const addresses = extractAddressesFromText(text);
      return filterIgnoredAddresses(addresses, options.ignoreAddresses);
    }

    // For URL parsing without auth, download first then parse
    const pdfResp = await axios.get(url, {
      responseType: 'arraybuffer',
    });
    const pdfData = await pdfParse(Buffer.from(pdfResp.data));
    const text = pdfData.text;

    const addresses = extractAddressesFromText(text);
    return filterIgnoredAddresses(addresses, options.ignoreAddresses);
  } catch (error) {
    console.error(`Failed to parse PDF from URL ${url}:`, error);
    throw new Error(`Failed to parse PDF from URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parses addresses from a local PDF file
 * 
 * @param filePath - The local file path to the PDF
 * @param options - Optional configuration including addresses to ignore
 * @returns Promise resolving to an array of unique addresses found in the PDF
 * 
 * @example
 * ```typescript
 * const addresses = await parseAddressesFromFile('/path/to/document.pdf', {
 *   ignoreAddresses: ['123 Main St']
 * });
 * ```
 */
export async function parseAddressesFromFile(
  filePath: string,
  options: AddressParserOptions = {}
): Promise<string[]> {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`PDF file not found: ${filePath}`);
    }

    // Read file and use the traditional pdf-parse API for local files
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    const text = pdfData.text;

    const addresses = extractAddressesFromText(text);
    return filterIgnoredAddresses(addresses, options.ignoreAddresses);
  } catch (error) {
    console.error(`Failed to parse PDF file ${filePath}:`, error);
    throw new Error(`Failed to parse PDF file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
