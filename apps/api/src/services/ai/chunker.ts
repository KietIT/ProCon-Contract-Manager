export interface TextChunk {
  index: number;
  text: string;
  tokenEstimate: number;
}

const CHARS_PER_TOKEN = 4; // rough estimate for English contract text
const MAX_TOKENS = 4000;
const OVERLAP_TOKENS = 200;

export function chunkText(rawText: string): TextChunk[] {
  const maxChars = MAX_TOKENS * CHARS_PER_TOKEN;
  const overlapChars = OVERLAP_TOKENS * CHARS_PER_TOKEN;

  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < rawText.length) {
    const end = Math.min(start + maxChars, rawText.length);

    // Try to break at paragraph boundary
    let actualEnd = end;
    if (end < rawText.length) {
      const boundary = rawText.lastIndexOf('\n\n', end);
      if (boundary > start + maxChars * 0.5) {
        actualEnd = boundary;
      }
    }

    const text = rawText.slice(start, actualEnd).trim();
    if (text.length > 0) {
      chunks.push({
        index,
        text,
        tokenEstimate: Math.ceil(text.length / CHARS_PER_TOKEN),
      });
      index++;
    }

    // If we've reached the end of the text, stop
    if (actualEnd >= rawText.length) break;

    // Move start forward with overlap, but never backwards
    const nextStart = actualEnd - overlapChars;
    start = nextStart > start ? nextStart : actualEnd;
  }

  return chunks;
}
