/**
 * Standalone test script for the AI contract extraction pipeline.
 * No HTTP server, no auth, no queue — direct function calls only.
 *
 * Usage:
 *   npx tsx src/scripts/test-extraction.ts <path-to-pdf-or-docx>
 */
import fs from 'fs';
import path from 'path';

// ── Load .env before importing services that read process.env at module level ──
const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

// ── Validate CLI args ──
const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: npx tsx src/scripts/test-extraction.ts <file-path>');
  process.exit(1);
}

const resolved = path.resolve(filePath);

if (!fs.existsSync(resolved)) {
  console.error(`File not found: ${resolved}`);
  process.exit(1);
}

const ext = path.extname(resolved).toLowerCase();
const mimeMap: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
};
const mimeType = mimeMap[ext];
if (!mimeType) {
  console.error(`Unsupported file type: ${ext} (supported: .pdf, .docx, .doc)`);
  process.exit(1);
}

async function main() {
  // Dynamic imports so .env is loaded before modules read process.env
  const { extractTextFromFile } = await import('../services/ai/file-extractor');
  const { extractContractData } = await import('../services/ai/extractor');

  const buffer = fs.readFileSync(resolved);
  console.log(`[1/3] Read ${buffer.length} bytes from ${path.basename(resolved)}`);

  console.log('[2/3] Extracting text...');
  const rawText = await extractTextFromFile(buffer, mimeType);
  console.log(`      Extracted ${rawText.length} characters of text`);

  console.log('[3/3] Running AI extraction (this may take a minute)...');
  const result = await extractContractData(rawText);

  console.log('\n========== EXTRACTION RESULT ==========\n');
  console.log(JSON.stringify(result, null, 2));

  // Summary
  const milestoneCount = result.milestones?.length ?? 0;
  const penaltyCount = result.penalty_clauses?.length ?? 0;
  const obligationCount = result.obligations?.length ?? 0;
  const paymentCount = result.payment_triggers?.length ?? 0;
  const keyDateCount = result.key_dates?.length ?? 0;
  const lowConfidence = result.low_confidence_count ?? 0;
  const chunksProcessed = result.chunks_processed ?? 0;

  console.log('\n========== SUMMARY ==========');
  console.log(`Chunks processed:    ${chunksProcessed}`);
  console.log(`Milestones found:    ${milestoneCount}`);
  console.log(`Obligations found:   ${obligationCount}`);
  console.log(`Penalties found:     ${penaltyCount}`);
  console.log(`Payment triggers:    ${paymentCount}`);
  console.log(`Key dates found:     ${keyDateCount}`);
  console.log(`Low confidence:      ${lowConfidence}`);
}

main().catch((err) => {
  console.error('Extraction failed:', err);
  process.exit(1);
});
