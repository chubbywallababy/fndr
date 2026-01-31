// Polyfill for pdfjs-dist in Node.js environment
if (typeof DOMMatrix === 'undefined') {
  global.DOMMatrix = require('canvas').DOMMatrix;
}

import axios, { AxiosRequestConfig } from 'axios';
import fs, { PathLike } from 'fs';
import Tesseract, { ImageLike } from 'tesseract.js';
import { fromPath } from 'pdf2pic';
import path from 'path';
import os from 'os';

import { PdfProcessingOptions } from '../types';
import { handlePdfAfterProcessing } from '../utils/pdf-storage';

export interface PdfReaderOptions extends PdfProcessingOptions {
  axiosConfig?: AxiosRequestConfig;
  forceOCR?: boolean;
  minTextLength?: number;
}

export interface PdfReadResult {
  text: string;
  usedOCR: boolean;
  pdfPath?: string;
}

/**
 * Extracts text from PDF using OCR (Tesseract)
 */
async function extractTextWithOCR(pdfPath: string): Promise<string> {
  const tempDir = path.join(os.tmpdir(), `pdf-ocr-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    console.log('[pdf-reader] Starting OCR extraction...');
    
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
        console.log(`[pdf-reader] Processing page ${pageNum}...`);
        const result = await converter(pageNum, { responseType: 'image' });
        
        // Perform OCR on the image
        const { data: { text } } = await Tesseract.recognize(
          result.path as ImageLike,
          'eng',
          {
            logger: m => {
              if (m.status === 'recognizing text') {
                console.log(`[pdf-reader] Page ${pageNum}: ${Math.round(m.progress * 100)}%`);
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
        console.log(`[pdf-reader] Completed OCR for ${pageNum - 1} pages`);
        break;
      }
    }

    return fullText;
  } finally {
    // Clean up temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {
      console.warn('[pdf-reader] Failed to clean up temp directory:', e);
    }
  }
}

/**
 * Downloads a PDF from a URL and extracts its text content
 * Uses standard PDF parsing first, falls back to OCR if needed
 */
export async function readPdfFromUrl(
  url: string,
  id: string,
  options: PdfReaderOptions = {}
): Promise<PdfReadResult> {
  const pdfPath = `${id}.pdf`;
  
  try {
    // Download PDF
    const pdfResp = await axios.get(url, {
      ...(options.axiosConfig || {}),
      responseType: 'arraybuffer',
    });
    
    fs.writeFileSync(pdfPath, pdfResp.data);
    console.log(`[pdf-reader] PDF saved to ${pdfPath}`);

    let text = '';
    let usedOCR = false;

    // Try standard text extraction first (unless forceOCR is true)
    if (!options.forceOCR) {
      try {
        const { PDFParse } = require('pdf-parse');
        const parser = new PDFParse({ data: pdfResp.data });
        text = await parser.getText();
        
        const minLength = options.minTextLength || 100;
        const hasRealContent = text.length > minLength && /[a-zA-Z]/.test(text);
        
        if (hasRealContent) {
          console.log('[pdf-reader] Using standard text extraction');
        } else {
          console.log(`[pdf-reader] Text extraction insufficient (length: ${text.length}), falling back to OCR`);
          text = await extractTextWithOCR(pdfPath);
          usedOCR = true;
        }
      } catch (parseError) {
        console.warn('[pdf-reader] Standard PDF parsing failed, falling back to OCR:', parseError);
        text = await extractTextWithOCR(pdfPath);
        usedOCR = true;
      }
    } else {
      console.log('[pdf-reader] Force OCR enabled');
      text = await extractTextWithOCR(pdfPath);
      usedOCR = true;
    }

    console.log(`[pdf-reader] Extracted text length: ${text.length} (OCR: ${usedOCR})`);

    // Handle PDF after processing (save or cleanup based on options)
    const savedPath = handlePdfAfterProcessing(pdfPath, id, options);
    
    return {
      text,
      usedOCR,
      pdfPath: savedPath || undefined,
    };
  } catch (error) {
    // Clean up on error (don't save failed PDFs)
    try {
      if (fs.existsSync(pdfPath)) {
        fs.unlinkSync(pdfPath);
      }
    } catch (cleanupError) {
      console.warn(`[pdf-reader] Failed to clean up PDF file ${pdfPath}:`, cleanupError);
    }
    console.error(`[pdf-reader] Failed to read PDF from URL ${url}:`, error);
    throw new Error(`Failed to read PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Saves extracted text to a file for debugging purposes
 */
export async function saveTextForDebugging(
  text: string,
  id: string,
  usedOCR?: boolean
): Promise<void> {
  try {
    const filename = `${id}.txt`;
    const metadata = usedOCR !== undefined 
      ? `=== Extraction Method: ${usedOCR ? 'OCR' : 'Standard PDF Parse'} ===\n` +
        `=== Text Length: ${text.length} characters ===\n` +
        `=== Timestamp: ${new Date().toISOString()} ===\n\n`
      : '';
    
    const content = metadata + text;
    
    fs.writeFileSync(filename, content, 'utf-8');
    console.log(`[pdf-reader] Debug text saved to ${filename} (${text.length} characters)`);
  } catch (error) {
    console.error(`[pdf-reader] Failed to save debug text file:`, error);
  }
}
