import { Worker } from 'bullmq';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { downloadFromS3 } from '../services/storage';
import { extractTextFromFile } from '../services/ai/file-extractor';
import { getExtractor } from '../services/ai/llm-client';

const extractContractData = getExtractor();

const parsingWorker = new Worker(
  'contract-parsing',
  async (job) => {
    const { contractId, fileKey, mimeType } = job.data;

    // Update status to processing
    await prisma.contract.update({
      where: { id: contractId },
      data: { aiExtractionStatus: 'processing' },
    });

    try {
      // Step 1: Download file from S3
      const fileBuffer = await downloadFromS3(fileKey);

      // Step 2: Extract raw text
      await job.updateProgress(20);
      const rawText = await extractTextFromFile(fileBuffer, mimeType);

      // Step 3: Run AI extraction
      await job.updateProgress(40);
      const extractionResult = await extractContractData(rawText);

      // Step 4: Save results to DB
      await job.updateProgress(90);
      await prisma.contract.update({
        where: { id: contractId },
        data: {
          aiExtractionStatus: 'review',
          aiExtractionData: extractionResult as any,
        },
      });

      await job.updateProgress(100);
      return { success: true, contractId, chunksProcessed: extractionResult.chunks_processed };
    } catch (error) {
      await prisma.contract.update({
        where: { id: contractId },
        data: { aiExtractionStatus: 'failed' },
      });
      throw error;
    }
  },
  {
    connection: redis as any,
    concurrency: 3,
  }
);

parsingWorker.on('completed', (job) => {
  console.log(`Job ${job.id} completed for contract ${job.data.contractId}`);
});

parsingWorker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

console.log('Contract parsing worker started');
