/**
 * Text normalization utilities for document processing
 */

/**
 * Normalizes text by replacing newlines and excessive whitespace
 */
export function normalizeWhitespace(text: string): string {
  return text
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Cleans text for address extraction - normalizes spacing around punctuation
 */
export function cleanForAddressExtraction(text: string): string {
  return text
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .trim();
}

/**
 * Normalizes text for legal document parsing
 * Handles common OCR artifacts and formatting issues
 */
export function normalizeForLegalParsing(text: string): string {
  return text
    // Normalize line breaks
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Fix common OCR issues
    .replace(/\s*\n\s*\n\s*/g, '\n\n')  // Normalize paragraph breaks
    .replace(/([a-z])\s*\n\s*([a-z])/gi, '$1 $2')  // Join broken lines within sentences
    .trim();
}

/**
 * Extracts a section of text between two markers
 */
export function extractBetweenMarkers(
  text: string,
  startMarker: RegExp | string,
  endMarker: RegExp | string
): string | null {
  const startMatch = typeof startMarker === 'string' 
    ? text.indexOf(startMarker)
    : text.search(startMarker);
  
  if (startMatch === -1) return null;
  
  const textAfterStart = text.substring(startMatch);
  const endMatch = typeof endMarker === 'string'
    ? textAfterStart.indexOf(endMarker)
    : textAfterStart.search(endMarker);
  
  if (endMatch === -1) return textAfterStart;
  
  return textAfterStart.substring(0, endMatch).trim();
}
