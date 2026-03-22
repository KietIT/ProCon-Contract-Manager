/**
 * Contract data extractor using OpenRouter API (inception/mercury-2).
 *
 * Uses native fetch instead of OpenAI SDK to support Mercury-2's
 * `reasoning` parameter which is not part of the standard OpenAI spec.
 *
 * Switch to this extractor by setting LLM_PROVIDER=openrouter in .env
 */
import { chunkText } from './chunker';
import { EXTRACTION_SYSTEM_PROMPT, buildUserPrompt } from './prompts';
import type { ExtractionResult } from '@tar/shared';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? '';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL ?? 'inception/mercury-2';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
      reasoning_details?: unknown;
    };
  }>;
  error?: { message: string };
}

async function callOpenRouter(messages: OpenRouterMessage[]): Promise<OpenRouterResponse> {
  const response = await fetch(OPENROUTER_BASE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      max_tokens: 4096,
      messages,
      reasoning: { enabled: true },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

export async function extractContractData(rawText: string): Promise<ExtractionResult> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not set in environment variables');
  }

  const chunks = chunkText(rawText);
  const allResults: Partial<ExtractionResult>[] = [];

  console.log(`[openrouter] Extracting with model: ${OPENROUTER_MODEL}, chunks: ${chunks.length}`);

  for (const chunk of chunks) {
    try {
      const result = await callOpenRouter([
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(chunk.text, chunk.index, chunks.length) },
      ]);

      if (result.error) {
        console.error(`[openrouter] API error on chunk ${chunk.index}:`, result.error.message);
        continue;
      }

      const content = result.choices[0]?.message?.content;
      if (!content) {
        console.warn(`[openrouter] Empty response for chunk ${chunk.index}`);
        continue;
      }

      // Strip markdown code fences if the model wraps its JSON response
      let jsonText = content.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }

      const parsed = JSON.parse(jsonText);
      allResults.push(parsed);
      console.log(`[openrouter] Chunk ${chunk.index + 1}/${chunks.length} parsed successfully`);
    } catch (err) {
      console.error(`[openrouter] Failed to process chunk ${chunk.index}:`, err);
    }
  }

  const merged = mergeResults(allResults);

  return {
    ...merged,
    chunks_processed: chunks.length,
    low_confidence_count: merged.milestones.filter((m) => m.confidence < 0.7).length,
  };
}

function mergeResults(results: Partial<ExtractionResult>[]): ExtractionResult {
  return {
    milestones: results.flatMap((r) => r.milestones ?? []),
    obligations: results.flatMap((r) => r.obligations ?? []),
    penalty_clauses: results.flatMap((r) => r.penalty_clauses ?? []),
    payment_triggers: results.flatMap((r) => r.payment_triggers ?? []),
    key_dates: results.flatMap((r) => r.key_dates ?? []),
    equipment_list: results.flatMap((r) => r.equipment_list ?? []),
    chunks_processed: 0,
    low_confidence_count: 0,
  };
}
