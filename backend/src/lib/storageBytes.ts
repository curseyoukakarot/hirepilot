import { supabaseAdmin } from './supabase';

type UploadOptions = {
  upsert?: boolean;
  cacheControl?: string;
};

async function ensureBucket(bucket: string, isPublic = false) {
  try {
    const { data } = await (supabaseAdmin as any).storage.getBucket(bucket);
    if (data) return;
  } catch {}
  try {
    await (supabaseAdmin as any).storage.createBucket(bucket, { public: isPublic });
  } catch {}
}

export async function downloadBytes(bucket: string, path: string): Promise<Uint8Array> {
  const { data, error } = await (supabaseAdmin as any).storage.from(bucket).download(path);
  if (error || !data) {
    throw new Error(error?.message || 'storage_download_failed');
  }
  const buffer = Buffer.from(await data.arrayBuffer());
  return new Uint8Array(buffer);
}

export async function uploadBytes(
  bucket: string,
  path: string,
  bytes: Uint8Array,
  contentType: string,
  options: UploadOptions = {}
): Promise<{ path: string }> {
  await ensureBucket(bucket, false);
  const { error, data } = await (supabaseAdmin as any).storage
    .from(bucket)
    .upload(path, Buffer.from(bytes), {
      contentType,
      upsert: Boolean(options.upsert),
      cacheControl: options.cacheControl,
    });
  if (error) throw new Error(error.message || 'storage_upload_failed');
  return { path: data?.path || path };
}

export async function getSignedUrl(bucket: string, path: string, expiresInSeconds = 60 * 60) {
  const { data, error } = await (supabaseAdmin as any).storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'signed_url_failed');
  }
  return data.signedUrl as string;
}
