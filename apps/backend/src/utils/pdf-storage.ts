import fs from 'fs';
import path from 'path';
import { PdfProcessingOptions } from '../types';

const DEFAULT_OUTPUT_DIR = './saved-pdfs';

/**
 * Ensures the PDF output directory exists
 */
export function ensurePdfOutputDir(options: PdfProcessingOptions): string {
  const outputDir = options.pdfOutputDir || DEFAULT_OUTPUT_DIR;
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`[pdf-storage] Created output directory: ${outputDir}`);
  }
  
  return outputDir;
}

/**
 * Gets the full path for saving a PDF file
 */
export function getPdfSavePath(id: string, options: PdfProcessingOptions): string {
  const outputDir = ensurePdfOutputDir(options);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${id}_${timestamp}.pdf`;
  return path.join(outputDir, filename);
}

/**
 * Saves PDF buffer to disk if savePdfs option is enabled
 * Returns the path where the PDF was saved, or null if not saved
 */
export function savePdfIfEnabled(
  pdfBuffer: Buffer,
  id: string,
  options: PdfProcessingOptions
): string | null {
  if (!options.savePdfs) {
    return null;
  }

  const savePath = getPdfSavePath(id, options);
  fs.writeFileSync(savePath, pdfBuffer);
  console.log(`[pdf-storage] PDF saved to: ${savePath}`);
  return savePath;
}

/**
 * Cleans up a temporary PDF file if savePdfs is disabled
 */
export function cleanupPdfIfNotSaving(
  pdfPath: string,
  options: PdfProcessingOptions
): void {
  if (options.savePdfs) {
    console.log(`[pdf-storage] Keeping PDF: ${pdfPath}`);
    return;
  }

  try {
    if (fs.existsSync(pdfPath)) {
      fs.unlinkSync(pdfPath);
      console.log(`[pdf-storage] Cleaned up temporary PDF: ${pdfPath}`);
    }
  } catch (error) {
    console.warn(`[pdf-storage] Failed to clean up PDF file ${pdfPath}:`, error);
  }
}

/**
 * Moves a temporary PDF to the permanent save location if savePdfs is enabled,
 * otherwise deletes it
 */
export function handlePdfAfterProcessing(
  tempPdfPath: string,
  id: string,
  options: PdfProcessingOptions
): string | null {
  if (!options.savePdfs) {
    cleanupPdfIfNotSaving(tempPdfPath, options);
    return null;
  }

  // Move to permanent location with timestamp
  const savePath = getPdfSavePath(id, options);
  
  try {
    fs.renameSync(tempPdfPath, savePath);
    console.log(`[pdf-storage] PDF moved to: ${savePath}`);
    return savePath;
  } catch (error) {
    // If rename fails (e.g., cross-device), copy and delete
    try {
      fs.copyFileSync(tempPdfPath, savePath);
      fs.unlinkSync(tempPdfPath);
      console.log(`[pdf-storage] PDF copied to: ${savePath}`);
      return savePath;
    } catch (copyError) {
      console.error(`[pdf-storage] Failed to save PDF:`, copyError);
      return null;
    }
  }
}
