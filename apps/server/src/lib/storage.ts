import { createClient } from '@supabase/supabase-js';

import env from '../config/env.js';

const supabaseUrl = env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export async function uploadToStorage(path: string, buffer: Uint8Array, contentType: string) {
  if (!supabase) {
    if (env.NODE_ENV !== 'production') {
      return path;
    }
    throw new Error('Supabase storage is not configured');
  }

  const { error } = await supabase.storage.from(env.SUPABASE_STORAGE_BUCKET).upload(path, buffer, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw error;
  }

  return path;
}

export async function createSignedStorageUrl(path: string, expiresInSeconds = 60 * 10) {
  if (!supabase) {
    if (env.NODE_ENV !== 'production') {
      return null;
    }
    throw new Error('Supabase storage is not configured');
  }

  const { data, error } = await supabase.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error) {
    throw error;
  }

  return data.signedUrl;
}
