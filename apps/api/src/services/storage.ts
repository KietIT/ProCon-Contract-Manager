import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs/promises';
import * as path from 'path';

// Use local filesystem storage when Supabase is not configured
const useLocalStorage = !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY;
const LOCAL_STORAGE_DIR = path.resolve(process.cwd(), '.local-storage');

const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'placeholder';
const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? 'contracts';

const supabase = useLocalStorage ? null : createClient(supabaseUrl, supabaseKey);

export async function uploadToS3(key: string, buffer: Buffer, contentType: string): Promise<string> {
  if (useLocalStorage) {
    const filePath = path.join(LOCAL_STORAGE_DIR, key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
    console.log(`[storage] Local file saved: ${filePath}`);
    return key;
  }

  const { error } = await supabase!.storage.from(bucket).upload(key, buffer, {
    contentType,
    upsert: true,
  });
  
  if (error) {
    console.error('Supabase upload error:', error);
    throw error;
  }
  return key;
}

export async function downloadFromS3(key: string): Promise<Buffer> {
  if (useLocalStorage) {
    const filePath = path.join(LOCAL_STORAGE_DIR, key);
    return fs.readFile(filePath);
  }

  const { data, error } = await supabase!.storage.from(bucket).download(key);
  if (error) throw error;
  
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function getPresignedUrl(key: string): Promise<string> {
  if (useLocalStorage) {
    return `file://${path.join(LOCAL_STORAGE_DIR, key)}`;
  }
  
  const { data, error } = await supabase!.storage.from(bucket).createSignedUrl(key, 3600);
  if (error) throw error;
  return data.signedUrl;
}
