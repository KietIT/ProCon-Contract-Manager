import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { createWorker } from 'tesseract.js';

export interface PageTextInfo {
  pageNum: number;
  text: string;
  startOffset: number; // character offset where this page begins in the full text
}

export interface PdfExtractionResult {
  text: string;
  pages: PageTextInfo[];
}

export async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  if (mimeType === 'application/pdf') {
    return extractFromPdf(buffer);
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    return extractFromDocx(buffer);
  }

  throw new Error(`Unsupported file type: ${mimeType}`);
}

async function extractFromPdf(buffer: Buffer): Promise<string> {
  // Step 1: Try pdf-parse first
  let extractedText = '';
  try {
    const data = await pdfParse(buffer);
    extractedText = data.text || '';
  } catch (err) {
    console.warn('pdf-parse failed:', (err as Error).message);
  }

  if (extractedText.trim().length >= 100) {
    console.log('Extracted via pdf-parse');
    return extractedText;
  }

  // Step 2: pdf-parse failed or returned too little text — fall back to OCR
  console.log('pdf-parse returned insufficient text (%d chars) — falling back to OCR', extractedText.trim().length);
  const ocrText = await extractPdfWithOcr(buffer);

  if (ocrText.trim().length > 0) {
    console.log('Extracted via OCR fallback');
    return ocrText;
  }

  // OCR also returned nothing — return whatever pdf-parse got (even if short)
  if (extractedText.trim().length > 0) {
    console.log('Extracted via pdf-parse (partial — OCR returned nothing)');
    return extractedText;
  }

  throw new Error('Could not extract any text from PDF via pdf-parse or OCR');
}

async function extractPdfWithOcr(pdfBuffer: Buffer): Promise<string> {
  // pdf-to-img converts PDF pages to PNG buffers using pdfjs-dist
  const { pdf } = await import('pdf-to-img');
  const doc = await pdf(pdfBuffer, { scale: 2.0 });

  const worker = await createWorker('eng');
  const pages: string[] = [];

  try {
    for await (const pageImage of doc) {
      const { data: { text } } = await worker.recognize(pageImage);
      pages.push(text);
    }
  } finally {
    await worker.terminate();
  }

  return pages.join('\n');
}

/**
 * Extract text from PDF with per-page info (page number + offset in full text).
 * Uses pdf-parse with custom pagerender to capture page boundaries.
 */
export async function extractFromPdfWithPages(buffer: Buffer): Promise<PdfExtractionResult> {
  const pageTexts: string[] = [];

  try {
    await pdfParse(buffer, {
      // Custom page renderer that captures each page's text separately
      pagerender: async function (pageData: any) {
        const textContent = await pageData.getTextContent();
        const text = textContent.items
          .map((item: any) => ('str' in item ? item.str : ''))
          .join(' ');
        pageTexts.push(text);
        return text;
      },
    });
  } catch (err) {
    console.warn('[extractFromPdfWithPages] pdf-parse failed:', (err as Error).message);
  }

  // Build full text with page offset tracking
  const pages: PageTextInfo[] = [];
  let fullText = '';

  for (let i = 0; i < pageTexts.length; i++) {
    pages.push({
      pageNum: i + 1,
      text: pageTexts[i],
      startOffset: fullText.length,
    });
    fullText += pageTexts[i];
    if (i < pageTexts.length - 1) {
      fullText += '\n\n'; // page separator (matches pdf-parse default behavior)
    }
  }

  return { text: fullText, pages };
}

async function extractFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}
