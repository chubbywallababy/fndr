/**
 * Document processing module
 * Handles PDF reading, OCR, and text extraction
 */

export { 
  readPdfFromUrl, 
  saveTextForDebugging,
  PdfReaderOptions,
  PdfReadResult 
} from './pdf-reader';

export {
  normalizeWhitespace,
  cleanForAddressExtraction,
  normalizeForLegalParsing,
  extractBetweenMarkers
} from './text-normalizer';
