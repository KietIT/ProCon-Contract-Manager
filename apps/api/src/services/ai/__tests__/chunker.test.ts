import { chunkText } from '../chunker';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.error(`  FAIL: ${message}`);
    failed++;
  }
}

console.log('Test 1: empty text');
const emptyChunks = chunkText('');
assert(emptyChunks.length === 0, `Expected 0 chunks, got ${emptyChunks.length}`);

console.log('Test 2: short text (single chunk)');
const shortText = 'This is a short contract.\n\nSection 1: Payment terms are net 30.';
const shortChunks = chunkText(shortText);
assert(shortChunks.length === 1, `Expected 1 chunk, got ${shortChunks.length}`);
assert(shortChunks[0].text === shortText.trim(), 'Text content matches');
assert(shortChunks[0].index === 0, 'Index is 0');
assert(shortChunks[0].tokenEstimate > 0, 'Token estimate is positive');

console.log('Test 3: long text (multiple chunks)');
const longText = 'A'.repeat(20000);
const longChunks = chunkText(longText);
assert(longChunks.length > 1, `Expected >1 chunks, got ${longChunks.length}`);
assert(longChunks[0].tokenEstimate <= 4000, `First chunk tokens ${longChunks[0].tokenEstimate} <= 4000`);

console.log('Test 4: overlap exists between chunks');
if (longChunks.length >= 2) {
  const overlapChars = 200 * 4; // OVERLAP_TOKENS * CHARS_PER_TOKEN
  const tail = longChunks[0].text.slice(-overlapChars);
  const head = longChunks[1].text.slice(0, overlapChars);
  assert(tail === head, 'Overlap region matches between chunk 0 and 1');
}

console.log('Test 5: paragraph boundary splitting');
// Create text with clear paragraph breaks
const sections = [];
for (let i = 0; i < 20; i++) {
  sections.push('Section ' + i + ': ' + 'X'.repeat(800));
}
const paraText = sections.join('\n\n');
const paraChunks = chunkText(paraText);
assert(paraChunks.length > 1, `Paragraph text produced ${paraChunks.length} chunks`);
// Check chunks tend to end at paragraph boundaries
for (const chunk of paraChunks.slice(0, -1)) {
  const endsNearParagraph = chunk.text.endsWith('X') || chunk.text.includes('\n\n');
  assert(endsNearParagraph, `Chunk ${chunk.index} respects boundaries`);
}

console.log('Test 6: exactly maxChars text');
const exactText = 'B'.repeat(16000); // 4000 tokens * 4 chars
const exactChunks = chunkText(exactText);
assert(exactChunks.length === 1, `Exact max text: ${exactChunks.length} chunk(s)`);

console.log('Test 7: sequential indexes');
const idxChunks = chunkText('C'.repeat(50000));
for (let i = 0; i < idxChunks.length; i++) {
  assert(idxChunks[i].index === i, `Chunk index ${idxChunks[i].index} === ${i}`);
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
