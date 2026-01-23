// Polyfill for pdfjs-dist in Node.js environment
if (typeof DOMMatrix === 'undefined') {
  global.DOMMatrix = require('canvas').DOMMatrix;
}

import axios, { AxiosRequestConfig } from 'axios';
import fs, {PathLike} from 'fs';
import Tesseract, {ImageLike} from 'tesseract.js';
import { fromPath } from 'pdf2pic';
import path from 'path';
import os from 'os';

export interface AddressParserOptions {
  ignoreAddresses?: string[];
  axiosConfig?: AxiosRequestConfig;
  /**
   * Force OCR even if text layer exists
   */
  forceOCR?: boolean;
  /**
   * Minimum text length to consider PDF parsed successfully
   * If text is shorter, will fall back to OCR
   */
  minTextLength?: number;
}

/**
 * Enhanced address regex that captures:
 * - Street number and name with common abbreviations
 * - Optional suite/unit/apartment numbers
 * - City, State ZIP (optional but commonly present)
 */
const ADDRESS_PATTERNS = [
  // Pattern 1: Full address with city, state, zip (handles commas)
  // Example: "5136 Old Versailles Road, Lexington, KY 40510"
  /\d{1,6}\s+[A-Za-z0-9.\-\s]+?\s+(?:St\.?|Street|Ave\.?|Avenue|Rd\.?|Road|Blvd\.?|Boulevard|Ln\.?|Lane|Dr\.?|Drive|Ct\.?|Court|Way|Terrace|Pl\.?|Place|Circle|Cir\.?|Parkway|Pkwy\.?|Highway|Hwy\.?)(?:[\s,]+(?:Suite|Ste\.?|Unit|Apt\.?|#)\s*[A-Za-z0-9\-]+)?[\s,]+[A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?/gi,
  
  // Pattern 2: Street address with optional suite/unit (no city/state)
  // Example: "05-C South 4th St." or "325 West Main Street, Suite 2300"
  /\d{1,6}(?:-[A-Z])?\s+(?:North|South|East|West|N\.?|S\.?|E\.?|W\.?)?\s*[A-Za-z0-9.\-\s]+?\s+(?:St\.?|Street|Ave\.?|Avenue|Rd\.?|Road|Blvd\.?|Boulevard|Ln\.?|Lane|Dr\.?|Drive|Ct\.?|Court|Way|Terrace|Pl\.?|Place|Circle|Cir\.?|Parkway|Pkwy\.?|Highway|Hwy\.?)(?:[\s,]+(?:Suite|Ste\.?|Unit|Apt\.?|#)\s*[A-Za-z0-9\-]+)?/gi,
];

/**
 * Normalizes text by replacing newlines and excessive whitespace
 * More efficient for large strings than multiple replace calls
 */
function normalizeTextForAddressExtraction(text: string): string {
  // Replace all newlines with spaces, then normalize multiple spaces to single space
  // This is efficient even for large strings (O(n) single pass)
  return text.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ');
}

/**
 * Cleans up extracted address by removing extra whitespace and normalizing format
 */
function cleanAddress(address: string): string {
  return address
    .replace(/\s{2,}/g, ' ')  // Multiple spaces to single space
    .replace(/\s*,\s*/g, ', ') // Normalize comma spacing
    .trim();
}

/**
 * Extracts addresses from text, handling multiple formats and multi-line addresses
 */
function extractAddressesFromText(text: string): string[] {
  // Normalize the text first - this handles multi-line addresses
  const normalizedText = normalizeTextForAddressExtraction(text);
  
  const foundAddresses = new Set<string>();
  
  // Try each pattern
  for (const pattern of ADDRESS_PATTERNS) {
    const matches = normalizedText.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const cleaned = cleanAddress(match);
        foundAddresses.add(cleaned);
      });
    }
  }
  
  // Convert Set to Array and return
  return Array.from(foundAddresses);
}

function filterIgnoredAddresses(
  addresses: string[],
  ignoreList?: string[]
): string[] {
  if (!ignoreList || ignoreList.length === 0) {
    return addresses;
  }
  const normalizedIgnoreList = ignoreList.map(normalizeTextForAddressExtraction);
  return addresses.filter((addr) => {
    const normalized = normalizeTextForAddressExtraction(addr);
    return !normalizedIgnoreList.includes(normalized);
  });
}

/**
 * Extracts text from PDF using OCR
 */
async function extractTextWithOCR(pdfPath: string): Promise<string> {
  const tempDir = path.join(os.tmpdir(), `pdf-ocr-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    console.log('Starting OCR extraction...');
    
    // Convert PDF pages to images
    const converter = fromPath(pdfPath, {
      density: 300,        // DPI - higher is better quality but slower
      saveFilename: 'page',
      savePath: tempDir,
      format: 'png',
      width: 2400,
      height: 2400,
    });

    // Get PDF page count - we'll try converting pages until we fail
    let fullText = '';
    let pageNum = 1;
    
    while (true) {
      try {
        console.log(`Processing page ${pageNum}...`);
        const result = await converter(pageNum, { responseType: 'image' });
        
        // Perform OCR on the image
        const { data: { text } } = await Tesseract.recognize(
          result.path as ImageLike,
          'eng',
          {
            logger: m => {
              if (m.status === 'recognizing text') {
                console.log(`Page ${pageNum}: ${Math.round(m.progress * 100)}%`);
              }
            }
          }
        );
        
        fullText += text + '\n\n';
        pageNum++;
        
        // Clean up the image file
        fs.unlinkSync(result.path as PathLike);
      } catch (error) {
        // No more pages
        console.log(`Completed OCR for ${pageNum - 1} pages`);
        break;
      }
    }

    // await saveTextForDebugging(fullText, pdfPath, true);

    return fullText;
  } finally {
    // Clean up temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {
      console.warn('Failed to clean up temp directory:', e);
    }
  }
}

/**
 * Parses addresses from a remote PDF URL with OCR fallback
 */
export async function parseAddressesFromUrl(
  url: string,
  id: string,
  options: AddressParserOptions = {}
): Promise<string[]> {
  const pdfPath = `${id}.pdf`;
  
  try {
    // Download PDF
    const pdfResp = await axios.get(url, {
      ...(options.axiosConfig || {}),
      responseType: 'arraybuffer',
    });
    
    // TODO - refactor so we don't have to download the PDF every time
    fs.writeFileSync(pdfPath, pdfResp.data);
    console.log(`PDF saved to ${pdfPath}`);

    let text = '';
    let usedOCR = false;

    // Try standard text extraction first (unless forceOCR is true)
    if (!options.forceOCR) {
      try {
        const {PDFParse} = require('pdf-parse');
        const parser = new PDFParse({data: pdfResp.data});
        text = await parser.getText();
        
        // console.log(`Standard extraction - Pages: ${parser}, Text length: ${pdfData.text.length}`);
        
        const minLength = options.minTextLength || 100;
        const hasRealContent = text.length > minLength && /[a-zA-Z]/.test(text);
        
        if (hasRealContent) {
          console.log('Using standard text extraction');
        } else {
          console.log(`Text extraction insufficient (length: ${text.length}), falling back to OCR`);
          text = await extractTextWithOCR(pdfPath);
          usedOCR = true;
        }
      } catch (parseError) {
        console.warn('Standard PDF parsing failed, falling back to OCR:', parseError);
        text = await extractTextWithOCR(pdfPath);
        usedOCR = true;
      }
    } else {
      console.log('Force OCR enabled');
      text = await extractTextWithOCR(pdfPath);
      usedOCR = true;
    }

    console.log(`Extracted text length: ${text.length} (OCR: ${usedOCR})`);
    console.log('Text sample:', text.substring(0, 300));

    const addresses = extractAddressesFromText(text);
    console.log(`Found ${addresses.length} addresses before filtering`);
    
    const filtered = filterIgnoredAddresses(addresses, options.ignoreAddresses);
    console.log(`Returning ${filtered.length} addresses after filtering`);
    
    return filtered;
  } catch (error) {
    console.error(`Failed to parse PDF from URL ${url}:`, error);
    throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    // Optionally clean up the PDF file
    try {
      fs.unlinkSync(pdfPath);
    } catch (error) {
      console.warn(`Failed to clean up PDF file ${pdfPath}:`, error);
    }
  }
}

/**
 * Saves extracted text to a file for debugging purposes
 * 
 * @param text - The text content to save
 * @param id - The identifier used for the filename
 * @param usedOCR - Optional flag to indicate if OCR was used
 */
export async function saveTextForDebugging(text: string, id: string, usedOCR?: boolean): Promise<void> {
  try {
    const filename = `${id}.txt`;
    const metadata = usedOCR !== undefined 
      ? `=== Extraction Method: ${usedOCR ? 'OCR' : 'Standard PDF Parse'} ===\n` +
        `=== Text Length: ${text.length} characters ===\n` +
        `=== Timestamp: ${new Date().toISOString()} ===\n\n`
      : '';
    
    const content = metadata + text;
    
    fs.writeFileSync(filename, content, 'utf-8');
    console.log(`Debug text saved to ${filename} (${text.length} characters)`);
  } catch (error) {
    console.error(`Failed to save debug text file:`, error);
  }
}