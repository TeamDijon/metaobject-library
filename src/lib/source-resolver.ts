import * as fs from 'fs';
import * as path from 'path';
import * as configManager from './config-manager.js';
import * as remoteFetcher from './remote-fetcher.js';
import { SourceType, type ResolvedSource } from '../types/index.js';

/**
 * Resolve a source identifier to an actual filesystem path
 */
export async function resolveSource(
  source: string,
  options: {
    force?: boolean;
    cwd?: string;
  } = {}
): Promise<ResolvedSource> {
  const { force = false, cwd = process.cwd() } = options;

  // Special case: 'repo' or 'repository' = configured repository
  if (source === 'repo' || source === 'repository') {
    const repoPath = await remoteFetcher.fetchConfiguredRepository({
      force,
      cwd,
    });
    const repo = configManager.getRepository(cwd);
    const cacheAge = remoteFetcher.getCacheAge(repo!.url, cwd);

    return {
      type: SourceType.REPOSITORY,
      path: repoPath,
      displayName: `Repository: ${repo!.url}`,
      cacheAge: cacheAge || undefined,
    };
  }

  // Check if it's a local export name
  if (configManager.exportExists(source, cwd)) {
    const exportPath = configManager.getExportPath(source, cwd);
    return {
      type: SourceType.LOCAL_EXPORT,
      path: exportPath,
      displayName: `Local Export: ${source}`,
    };
  }

  // Check if it's an absolute or relative filesystem path
  const resolvedPath = path.isAbsolute(source)
    ? source
    : path.resolve(cwd, source);

  if (fs.existsSync(resolvedPath)) {
    return {
      type: SourceType.FILESYSTEM_PATH,
      path: resolvedPath,
      displayName: `Path: ${resolvedPath}`,
    };
  }

  // Source not found
  throw new Error(
    `Source "${source}" not found. Please check:\n` +
      `  - Repository configured: Use "metabridge config get-repo"\n` +
      `  - Local export exists: Use "metabridge sources list"\n` +
      `  - Path is correct: ${resolvedPath}`
  );
}

/**
 * Validate that a source has a valid manifest
 */
export function validateSource(sourcePath: string): boolean {
  const manifestPath = path.join(sourcePath, 'manifest.toml');
  return fs.existsSync(manifestPath);
}

/**
 * List all available sources
 */
export function listAvailableSources(cwd: string = process.cwd()): Array<{
  name: string;
  type: string;
  details: string;
}> {
  const sources: Array<{ name: string; type: string; details: string }> = [];

  // Add configured repository
  const repo = configManager.getRepository(cwd);
  if (repo) {
    const info = remoteFetcher.getRepositoryInfo(repo.url, cwd);
    const ageStr = info.age
      ? info.stale
        ? `stale (${Math.floor(info.age / 60)}m old)`
        : `fresh (${Math.floor(info.age / 60)}m old)`
      : 'not cached';

    sources.push({
      name: 'repo',
      type: 'repository',
      details: `${repo.url} [${ageStr}]`,
    });
  }

  // Add local exports
  const exports = configManager.listExports(cwd);
  exports.forEach((exportName) => {
    const exportPath = configManager.getExportPath(exportName, cwd);
    const hasManifest = validateSource(exportPath);
    sources.push({
      name: exportName,
      type: 'local_export',
      details: hasManifest ? 'valid' : 'missing manifest',
    });
  });

  return sources;
}

/**
 * Format cache age for display
 */
export function formatCacheAge(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) {
    return 'not cached';
  }

  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ago`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m ago`;
  } else if (minutes > 0) {
    return `${minutes}m ago`;
  } else {
    return `${seconds}s ago`;
  }
}
