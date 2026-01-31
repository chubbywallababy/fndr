/**
 * @deprecated This file is deprecated. Import from the new modular locations instead:
 * - Document reading: '../document/pdf-reader'
 * - Address parsing: '../parsers/address-parser'
 * - Lis Pendens parsing: '../parsers/lis-pendens-parser'
 * - Lead classification: '../classifiers/lead-classifier'
 * 
 * This file re-exports for backward compatibility.
 */

// Re-export from new locations for backward compatibility
export {
  extractAddressesFromText as extractParsedAddressesFromText,
  filterIgnoredAddresses,
  scoreAddressCandidate,
  getBestAddress,
  ParsedAddress,
  AddressQuality,
} from '../parsers/address-parser';

export {
  readPdfFromUrl,
  saveTextForDebugging,
  PdfReaderOptions,
  PdfReadResult,
} from '../document/pdf-reader';

// Legacy interface re-export
import { PdfReaderOptions } from '../document/pdf-reader';
import { readPdfFromUrl } from '../document/pdf-reader';
import { extractAddressesFromText, filterIgnoredAddresses, ParsedAddress } from '../parsers/address-parser';

export interface AddressParserOptions extends PdfReaderOptions {
  ignoreAddresses?: string[];
}

/**
 * @deprecated Use readPdfFromUrl and extractAddressesFromText separately
 * Legacy function that combines PDF reading and address extraction
 */
export async function parseAddressesFromUrl(
  url: string,
  id: string,
  options: AddressParserOptions = {}
): Promise<ParsedAddress[]> {
  const { text } = await readPdfFromUrl(url, id, options);
  const addresses = extractAddressesFromText(text);
  return filterIgnoredAddresses(addresses, options.ignoreAddresses);
}
