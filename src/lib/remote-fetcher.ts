import * as fs from 'fs';
import * as path from 'path';
import simpleGit, { SimpleGit, CleanOptions } from 'simple-git';
import * as crypto from 'crypto';
import * as configManager from './config-manager.js';

/**
 * Sanitize repository URL for use as directory name
 */
function sanitizeRepoName(url: string): string {
  // Extract repo name from URL
  const match = url.match(/([^/]+\/[^/]+?)(\.git)?$/);
  if (match) {
    return match[1].replace(/[^a-zA-Z0-9-]/g, '-');
  }
  // Fallback: use hash of URL
  return crypto.createHash('md5').update(url).digest('hex').slice(0, 12);
}

/**
 * Get the cache path for a repository
 */
export function getRepoCachePath(url: string, cwd: string = process.cwd()): string {
  const cacheDir = configManager.getCacheDir(cwd);
  const repoName = sanitizeRepoName(url);
  return path.join(cacheDir, repoName);
}

/**
 * Check if repository is already cached
 */
export function isRepoCached(url: string, cwd: string = process.cwd()): boolean {
  const cachePath = getRepoCachePath(url, cwd);
  return fs.existsSync(path.join(cachePath, '.git'));
}

/**
 * Get cache age in seconds
 */
export function getCacheAge(url: string, cwd: string = process.cwd()): number | null {
  if (!isRepoCached(url, cwd)) {
    return null;
  }

  const cachePath = getRepoCachePath(url, cwd);
  const gitDir = path.join(cachePath, '.git', 'FETCH_HEAD');

  if (!fs.existsSync(gitDir)) {
    // No fetch has been done, use directory creation time
    const stats = fs.statSync(cachePath);
    return Math.floor((Date.now() - stats.ctimeMs) / 1000);
  }

  const stats = fs.statSync(gitDir);
  return Math.floor((Date.now() - stats.mtimeMs) / 1000);
}

/**
 * Check if cache is stale based on TTL
 */
export function isCacheStale(
  url: string,
  ttl: number = 3600,
  cwd: string = process.cwd()
): boolean {
  const age = getCacheAge(url, cwd);
  if (age === null) {
    return true; // Not cached = stale
  }
  return age > ttl;
}

/**
 * Clone a repository to cache
 */
export async function cloneRepository(
  url: string,
  branch: string = 'main',
  cwd: string = process.cwd()
): Promise<string> {
  const cachePath = getRepoCachePath(url, cwd);
  const cacheDir = configManager.getCacheDir(cwd);

  // Ensure cache directory exists
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  // Remove existing cache if present
  if (fs.existsSync(cachePath)) {
    fs.rmSync(cachePath, { recursive: true, force: true });
  }

  console.log(`Cloning repository: ${url}`);
  console.log(`Branch: ${branch}`);

  try {
    const git: SimpleGit = simpleGit();

    // Configure authentication if GITHUB_TOKEN is available
    const token = process.env.GITHUB_TOKEN;
    let cloneUrl = url;
    if (token && url.includes('github.com')) {
      // Inject token into URL for authentication
      cloneUrl = url.replace(
        'https://github.com/',
        `https://${token}@github.com/`
      );
    }

    await git.clone(cloneUrl, cachePath, ['--branch', branch, '--depth', '1']);
    console.log('✓ Repository cloned successfully');
    return cachePath;
  } catch (error) {
    // Clean up partial clone
    if (fs.existsSync(cachePath)) {
      fs.rmSync(cachePath, { recursive: true, force: true });
    }
    throw new Error(
      `Failed to clone repository: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Update an existing cached repository
 */
export async function updateRepository(
  url: string,
  branch: string = 'main',
  cwd: string = process.cwd()
): Promise<string> {
  const cachePath = getRepoCachePath(url, cwd);

  if (!isRepoCached(url, cwd)) {
    return cloneRepository(url, branch, cwd);
  }

  console.log(`Updating repository cache: ${url}`);

  try {
    const git: SimpleGit = simpleGit(cachePath);

    // Fetch latest changes
    await git.fetch(['origin', branch]);

    // Reset to latest
    await git.reset(['--hard', `origin/${branch}`]);

    // Clean untracked files
    await git.clean(CleanOptions.FORCE + CleanOptions.RECURSIVE);

    console.log('✓ Repository updated successfully');
    return cachePath;
  } catch (error) {
    console.warn(
      `Failed to update repository, will re-clone: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    return cloneRepository(url, branch, cwd);
  }
}

/**
 * Fetch repository with caching logic
 */
export async function fetchRepository(
  url: string,
  branch: string = 'main',
  options: {
    force?: boolean;
    ttl?: number;
    cwd?: string;
  } = {}
): Promise<string> {
  const { force = false, ttl = 3600, cwd = process.cwd() } = options;

  // Force refresh
  if (force) {
    return updateRepository(url, branch, cwd);
  }

  // Check if cached and fresh
  if (isRepoCached(url, cwd)) {
    const age = getCacheAge(url, cwd);
    if (age !== null && age <= ttl) {
      const cachePath = getRepoCachePath(url, cwd);
      console.log(`Using cached repository (age: ${Math.floor(age / 60)}m)`);
      return cachePath;
    }

    // Cache is stale, update it
    return updateRepository(url, branch, cwd);
  }

  // Not cached, clone it
  return cloneRepository(url, branch, cwd);
}

/**
 * Validate that the cached repository has a valid manifest
 */
export function validateRepositoryStructure(repoPath: string): boolean {
  const manifestPath = path.join(repoPath, 'manifest.toml');
  if (!fs.existsSync(manifestPath)) {
    return false;
  }

  // Check for metaobjects or metafields directories
  const metaobjectsDir = path.join(repoPath, 'metaobjects');
  const metafieldsDir = path.join(repoPath, 'metafields');

  return fs.existsSync(metaobjectsDir) || fs.existsSync(metafieldsDir);
}

/**
 * Fetch repository from config
 */
export async function fetchConfiguredRepository(
  options: {
    force?: boolean;
    cwd?: string;
  } = {}
): Promise<string> {
  const { force = false, cwd = process.cwd() } = options;

  const repo = configManager.getRepository(cwd);
  if (!repo) {
    throw new Error(
      'No repository configured. Use "metabridge config set-repo <url>" first.'
    );
  }

  const repoPath = await fetchRepository(repo.url, repo.branch || 'main', {
    force,
    ttl: repo.cache_ttl || 3600,
    cwd,
  });

  // Validate repository structure
  if (!validateRepositoryStructure(repoPath)) {
    throw new Error(
      'Invalid repository structure: missing manifest.toml or definition directories'
    );
  }

  return repoPath;
}

/**
 * Get repository info
 */
export function getRepositoryInfo(url: string, cwd: string = process.cwd()): {
  cached: boolean;
  age: number | null;
  path: string;
  stale: boolean;
} {
  const cached = isRepoCached(url, cwd);
  const age = getCacheAge(url, cwd);
  const path = getRepoCachePath(url, cwd);
  const repo = configManager.getRepository(cwd);
  const ttl = repo?.cache_ttl || 3600;
  const stale = isCacheStale(url, ttl, cwd);

  return { cached, age, path, stale };
}
