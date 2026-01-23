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

const ADDRESS_REGEX = /\d{1,6}\s+[A-Za-z0-9.\- ]+\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Ln|Lane|Dr|Drive|Ct|Court|Way|Terrace|Pl|Place|Circle|Cir)\b/gi;

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase().replace(/\s+/g, ' ');
}

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

function extractAddressesFromText(text: string): string[] {
  const matches = text.match(ADDRESS_REGEX);
  if (!matches) {
    return [];
  }
  const uniqueAddresses = [...new Set(matches.map((addr) => addr.trim()))];
  return uniqueAddresses;
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
    
    // fs.writeFileSync(pdfPath, pdfResp.data);
    // console.log(`PDF saved to ${pdfPath}`);

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
    // fs.unlinkSync(pdfPath);
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