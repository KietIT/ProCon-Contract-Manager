import { Queue } from 'bullmq';
import { redis } from '../lib/redis';

export const parsingQueue = new Queue('contract-parsing', { connection: redis as any });
