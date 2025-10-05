import { createClient } from '@supabase/supabase-js';
import { exec as _exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';

const exec = promisify(_exec);
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const BUCKET = 'linkedin-snapshots';

export async function packUserDataDir(sessionId: string, basePath = `/var/lib/hirepilot/user-data-dir/${sessionId}`) {
  const out = `/tmp/${sessionId}.tar.gz`;
  await exec(`tar -C $(dirname ${basePath}) -czf ${out} $(basename ${basePath}) || true`);
  const stat = await fs.promises.stat(out);
  return { localPath: out, size: stat.size };
}

export async function uploadSnapshot(userId: string, sessionId: string, localPath: string) {
  const key = `${userId}/${sessionId}.tar.gz`;
  const file = await fs.promises.readFile(localPath);
  const { error } = await supabase.storage.from(BUCKET).upload(key, file, { upsert: true, contentType: 'application/gzip' });
  if (error) throw error;
  return key;
}

export async function downloadSnapshot(snapshotKey: string, destDir: string) {
  const { data, error } = await supabase.storage.from(BUCKET).download(snapshotKey);
  if (error) throw error;
  const tmp = `/tmp/snap-${Date.now()}.tar.gz`;
  await fs.promises.writeFile(tmp, Buffer.from(await data.arrayBuffer()));
  await fs.promises.mkdir(destDir, { recursive: true });
  await exec(`tar -C ${destDir} -xzf ${tmp}`);
}


