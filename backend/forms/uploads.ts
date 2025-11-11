import { supabase } from '../lib/supabase';

const BUCKET = process.env.FORMS_UPLOADS_BUCKET || 'form-uploads';

export async function getSignedUploadUrl(filename: string, contentType: string) {
  const safeName = String(filename || 'file').replace(/[^a-zA-Z0-9_.-]/g, '_');
  const path = `forms/${Date.now()}_${safeName}`;
  // Supabase Storage signed upload URL
  // 1) Ensure bucket exists (best-effort)
  try {
    const { data: list } = await supabase.storage.listBuckets();
    const exists = (list || []).some((b: any) => b.name === BUCKET);
    if (!exists) {
      await supabase.storage.createBucket(BUCKET, { public: false } as any);
    }
  } catch {}
  // 2) Create signed upload URL token
  const { data, error } = await (supabase as any).storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) throw error;
  // Client will call uploadToSignedUrl with token + file
  return {
    path,
    token: data?.token,
    bucket: BUCKET,
    contentType,
  };
}


