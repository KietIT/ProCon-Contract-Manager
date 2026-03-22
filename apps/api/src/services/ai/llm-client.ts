/**
 * LLM provider factory — selects the extraction function based on LLM_PROVIDER env.
 *
 * Supported providers:
 *   - 'byteplus' (default) — BytePlus Ark with Seed model
 *   - 'openrouter' — OpenRouter with inception/mercury-2
 *
 * Usage:
 *   import { getExtractor } from '../services/ai/llm-client';
 *   const extractContractData = getExtractor();
 */
import type { ExtractionResult } from '@tar/shared';

type Extractor = (rawText: string) => Promise<ExtractionResult>;

export function getExtractor(): Extractor {
  const provider = process.env.LLM_PROVIDER ?? 'byteplus';

  switch (provider) {
    case 'openrouter': {
      const { extractContractData } = require('./extractor-openrouter');
      console.log('[llm-client] Using OpenRouter provider');
      return extractContractData;
    }
    case 'byteplus':
    default: {
      const { extractContractData } = require('./extractor');
      console.log('[llm-client] Using BytePlus provider');
      return extractContractData;
    }
  }
}
