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
  forceOCR?: boolean;
  minTextLength?: number;
}

export type AddressQuality = "high" | "medium" | "low";

export interface ParsedAddress {
  raw: string;
  cleaned: string;
  score: number;
  quality: AddressQuality;
  isLikelyAddress: boolean;
  reasons: string[];
}

/**
 * Enhanced address regex patterns (extraction only, not validation)
 */
const ADDRESS_PATTERNS = [
  // Full address with city, state, zip
  /\d{1,6}\s+[A-Za-z0-9.\-\s]+?\s+(?:St\.?|Street|Ave\.?|Avenue|Rd\.?|Road|Blvd\.?|Boulevard|Ln\.?|Lane|Dr\.?|Drive|Ct\.?|Court|Way|Terrace|Pl\.?|Place|Circle|Cir\.?|Parkway|Pkwy\.?|Highway|Hwy\.?)(?:[\s,]+(?:Suite|Ste\.?|Unit|Apt\.?|#)\s*[A-Za-z0-9\-]+)?[\s,]+[A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?/gi,

  // Street only (no city/state)
  /\d{1,6}(?:-[A-Z])?\s+(?:North|South|East|West|N\.?|S\.?|E\.?|W\.?)?\s*[A-Za-z0-9.\-\s]+?\s+(?:St\.?|Street|Ave\.?|Avenue|Rd\.?|Road|Blvd\.?|Boulevard|Ln\.?|Lane|Dr\.?|Drive|Ct\.?|Court|Way|Terrace|Pl\.?|Place|Circle|Cir\.?|Parkway|Pkwy\.?|Highway|Hwy\.?)(?:[\s,]+(?:Suite|Ste\.?|Unit|Apt\.?|#)\s*[A-Za-z0-9\-]+)?/gi,
];

/**
 * Normalizes text by replacing newlines and excessive whitespace
 */
function normalizeTextForAddressExtraction(text: ParsedAddress): ParsedAddress {
  return {
    ...text,
    raw: text.raw.replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " "),
    cleaned: text.cleaned.replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " "),
  };
}

/**
 * Cleans extracted address
 */
function cleanAddress(address: string): string {
  return address
    .replace(/\s{2,}/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .trim();
}

/* ============================================================
   Validation & scoring logic (NEW)
   ============================================================ */

const STREET_TYPE_REGEX =
  /\b(st|street|rd|road|ave|avenue|blvd|boulevard|ln|lane|dr|drive|ct|court|way|terrace|pl|place|circle|cir|parkway|pkwy|highway|hwy)\b/i;

const CITY_REGEX = /\bLexington\b/i;
const STATE_REGEX = /\bKY\b|\bKentucky\b/i;
const ZIP_REGEX = /\b\d{5}(?:-\d{4})?\b/;

/**
 * Common false-positive phrases from legal / narrative text
 */
const NON_ADDRESS_PATTERNS = [
  /\bsouth of\b/i,
  /\bnorth of\b/i,
  /\beast of\b/i,
  /\bwest of\b/i,
  /\bcommonwealth\b/i,
  /\bcircuit court\b/i,
  /\bcase\b/i,
  /\bfiled\b/i,
  /\bplaintiff\b/i,
  /\bdefendant\b/i,
];

/**
 * Street number must appear near beginning
 */
const LEADING_NUMBER_REGEX = /^\s*\d{1,6}(\s|[A-Za-z])/;

/**
 * Scores an extracted string and determines if it is likely an address
 */
function scoreAddressCandidate(address: string): ParsedAddress {
  const cleaned = cleanAddress(address);
  const reasons: string[] = [];
  let score = 0;

  // Hard rejection
  if (NON_ADDRESS_PATTERNS.some(r => r.test(cleaned))) {
    return {
      raw: address,
      cleaned,
      score: 0,
      quality: "low",
      isLikelyAddress: false,
      reasons: ["matched_non_address_phrase"],
    };
  }

  // Leading street number
  if (LEADING_NUMBER_REGEX.test(cleaned)) {
    score += 40;
  } else {
    reasons.push("no_leading_street_number");
  }

  // Street type
  if (STREET_TYPE_REGEX.test(cleaned)) {
    score += 30;
  } else {
    reasons.push("no_street_type");
  }

  // City
  if (CITY_REGEX.test(cleaned)) score += 10;

  // State
  if (STATE_REGEX.test(cleaned)) score += 10;

  // Zip
  if (ZIP_REGEX.test(cleaned)) score += 10;

  let quality: AddressQuality = "low";
  if (score >= 80) quality = "high";
  else if (score >= 50) quality = "medium";

  return {
    raw: address,
    cleaned,
    score,
    quality,
    isLikelyAddress: score >= 50,
    reasons,
  };
}

/**
 * Extracts and validates addresses from text
 */
export function extractParsedAddressesFromText(text: string): ParsedAddress[] {
  const parsedAddresses = scoreAddressCandidate(text);
  const normalizedText = normalizeTextForAddressExtraction(parsedAddresses);
  const foundAddresses = new Set<string>();

  for (const pattern of ADDRESS_PATTERNS) {
    const matches = normalizedText.raw.match(pattern);
    if (matches) {
      matches.forEach(match => foundAddresses.add(cleanAddress(match)));
    }
  }

  return Array.from(foundAddresses).map(scoreAddressCandidate);
}


function filterIgnoredAddresses(
  addresses: ParsedAddress[],
  ignoreList?: ParsedAddress[]
): ParsedAddress[] {
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
): Promise<ParsedAddress[]> {
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

    const addresses = extractParsedAddressesFromText(text);
    console.log(`Found ${addresses.length} addresses before filtering`);
    
    const filtered = filterIgnoredAddresses(addresses, options.ignoreAddresses?.map(scoreAddressCandidate));
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