import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { logger } from '../lib/logger';
import { createBranch, cloneOrUpdateRepo } from './gitClient';
import { runCommand } from './commandRunner';
import { DiffChunk, PatchStatus, StoredPatch } from './types';

interface StorePatchInput {
  diffs: DiffChunk[];
  summary?: string;
  relatedErrorId?: string;
  relatedHealthCheckId?: string;
  relatedScenarioRunId?: string;
  relatedSweepRunId?: string;
  branch?: string;
}

const inMemoryPatchStore = new Map<string, StoredPatch>();

export async function storeProposedPatch(input: StorePatchInput): Promise<StoredPatch> {
  if (!input.diffs?.length) {
    throw new Error('Patch must include at least one diff chunk');
  }

  const now = new Date().toISOString();
  const patch: StoredPatch = {
    id: randomUUID(),
    relatedErrorId: input.relatedErrorId,
    relatedHealthCheckId: input.relatedHealthCheckId,
    relatedScenarioRunId: input.relatedScenarioRunId,
    relatedSweepRunId: input.relatedSweepRunId,
    status: 'proposed',
    diffs: input.diffs,
    summary: input.summary,
    branch: input.branch,
    createdAt: now,
    updatedAt: now,
  };

  inMemoryPatchStore.set(patch.id, patch);
  return patch;
}

async function writeTempPatch(diffs: DiffChunk[]): Promise<string> {
  const tmpPath = path.join(os.tmpdir(), `repo-guardian-patch-${randomUUID()}.diff`);
  const body = diffs
    .map((chunk) => {
      const header = chunk.description ? `# ${chunk.description}\n` : '';
      return `${header}${chunk.diff}`;
    })
    .join('\n\n');
  await fs.writeFile(tmpPath, body, 'utf-8');
  return tmpPath;
}

export async function applyPatchToFixBranch(patchId: string): Promise<StoredPatch> {
  const patch = inMemoryPatchStore.get(patchId);
  if (!patch) {
    throw new Error('Patch not found');
  }

  const repoPath = await cloneOrUpdateRepo();
  const targetBranch = patch.branch || `repo-guardian/fix-${patchId.slice(0, 8)}`;

  try {
    await createBranch(repoPath, targetBranch);
    const patchFile = await writeTempPatch(patch.diffs);
    await runCommand('git', ['apply', patchFile], repoPath);
    patch.status = 'applied';
    patch.branch = targetBranch;
  } catch (error) {
    logger.error({ error, patchId }, '[repoAgent][patchService] Failed to apply patch');
    patch.status = 'failed';
    throw error;
  } finally {
    patch.updatedAt = new Date().toISOString();
    inMemoryPatchStore.set(patch.id, patch);
  }

  return patch;
}

export function getPatchById(patchId: string): StoredPatch | undefined {
  return inMemoryPatchStore.get(patchId);
}

export function listPatches(): StoredPatch[] {
  return Array.from(inMemoryPatchStore.values());
}

