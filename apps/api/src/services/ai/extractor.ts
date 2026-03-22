import OpenAI from 'openai';
import { chunkText } from './chunker';
import { EXTRACTION_SYSTEM_PROMPT, buildUserPrompt } from './prompts';
import type { ExtractionResult } from '@tar/shared';

const client = new OpenAI({
  apiKey: process.env.BYTEPLUS_API_KEY,
  baseURL: 'https://ark.ap-southeast.bytepluses.com/api/v3',
});

const model = process.env.BYTEPLUS_MODEL ?? 'seed-1-6-250915';

export async function extractContractData(rawText: string): Promise<ExtractionResult> {
  const chunks = chunkText(rawText);

  const allResults: Partial<ExtractionResult>[] = [];

  for (const chunk of chunks) {
    const response = await client.chat.completions.create({
      model,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildUserPrompt(chunk.text, chunk.index, chunks.length),
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) continue;

    try {
      // Strip markdown code fences if the model wraps its JSON response
      let jsonText = content.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }
      const parsed = JSON.parse(jsonText);
      allResults.push(parsed);
    } catch (err) {
      console.error(`Failed to parse chunk ${chunk.index}:`, err);
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
