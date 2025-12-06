import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { logger } from '../lib/logger';
import { runCommand } from './commandRunner';

const REPO_AGENT_GIT_URL = process.env.REPO_AGENT_GIT_URL;
const REPO_AGENT_GIT_TOKEN = process.env.REPO_AGENT_GIT_TOKEN;
const REPO_AGENT_DEFAULT_BRANCH = process.env.REPO_AGENT_DEFAULT_BRANCH || 'main';
const REPO_AGENT_WORKDIR =
  process.env.REPO_AGENT_WORKDIR || path.join(os.homedir(), '.hirepilot-repo-guardian');

const REPO_WORKTREE = path.join(REPO_AGENT_WORKDIR, 'repo');

async function ensureWorktree() {
  await fs.mkdir(REPO_AGENT_WORKDIR, { recursive: true });
  return REPO_WORKTREE;
}

async function pathExists(target: string) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function getAuthenticatedGitUrl(): string {
  if (!REPO_AGENT_GIT_URL) {
    throw new Error('REPO_AGENT_GIT_URL is not configured');
  }

  if (!REPO_AGENT_GIT_TOKEN) {
    return REPO_AGENT_GIT_URL;
  }

  try {
    const parsed = new URL(REPO_AGENT_GIT_URL);
    if (!parsed.username) {
      // Many providers expect either the token as username or "x-access-token"
      parsed.username = process.env.REPO_AGENT_GIT_USERNAME || REPO_AGENT_GIT_TOKEN;
      parsed.password = parsed.password || (process.env.REPO_AGENT_GIT_PASSWORD || '');
    }
    return parsed.toString();
  } catch (error) {
    logger.warn(
      { error },
      '[repoAgent][gitClient] Failed to inject token into git URL; falling back to raw URL'
    );
    // Fallback: naive replacement; note tokens containing '@' may need urlencoding
    return REPO_AGENT_GIT_URL.replace(
      /^https:\/\//,
      `https://${encodeURIComponent(REPO_AGENT_GIT_TOKEN)}@`
    );
  }
}

async function runGit(args: string[], cwd: string) {
  await runCommand('git', args, cwd);
}

export async function cloneOrUpdateRepo(): Promise<string> {
  const repoPath = await ensureWorktree();
  const hasGitDir = await pathExists(path.join(repoPath, '.git'));
  const remoteUrl = getAuthenticatedGitUrl();

  if (!hasGitDir) {
    logger.info('[repoAgent][gitClient] Cloning monitored repository');
    await runCommand(
      'git',
      ['clone', '--branch', REPO_AGENT_DEFAULT_BRANCH, '--single-branch', remoteUrl, repoPath],
      REPO_AGENT_WORKDIR
    );
    return repoPath;
  }

  logger.debug?.('[repoAgent][gitClient] Updating existing repository cache');
  await runGit(['fetch', '--all'], repoPath);
  await runGit(['checkout', REPO_AGENT_DEFAULT_BRANCH], repoPath);
  await runGit(['pull', '--ff-only', 'origin', REPO_AGENT_DEFAULT_BRANCH], repoPath);
  return repoPath;
}

export async function getCurrentBranch(localPath: string): Promise<string> {
  const result = await runCommand('git', ['rev-parse', '--abbrev-ref', 'HEAD'], localPath);
  return result.stdout.trim();
}

export async function createBranch(localPath: string, branchName: string): Promise<void> {
  await runGit(['checkout', '-B', branchName], localPath);
}

export async function getDiff(localPath: string, args: string[] = []): Promise<string> {
  const result = await runCommand('git', ['diff', ...args], localPath);
  return result.stdout;
}

