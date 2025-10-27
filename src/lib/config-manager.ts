import * as fs from 'fs';
import * as path from 'path';
import * as toml from '@iarna/toml';
import type {
  MetabridgeConfig,
  RepositoryConfig,
  StoreAlias,
} from '../types/index.js';

/**
 * Default configuration directory
 */
const CONFIG_DIR = '.metabridge';
const CONFIG_FILE = 'config.toml';
const CACHE_DIR = 'cache';
const EXPORTS_DIR = 'exports';

/**
 * Get the metabridge directory path
 */
export function getMetabridgeDir(cwd: string = process.cwd()): string {
  return path.join(cwd, CONFIG_DIR);
}

/**
 * Get the config file path
 */
export function getConfigPath(cwd: string = process.cwd()): string {
  return path.join(getMetabridgeDir(cwd), CONFIG_FILE);
}

/**
 * Get the cache directory path
 */
export function getCacheDir(cwd: string = process.cwd()): string {
  return path.join(getMetabridgeDir(cwd), CACHE_DIR);
}

/**
 * Get the exports directory path
 */
export function getExportsDir(cwd: string = process.cwd()): string {
  return path.join(getMetabridgeDir(cwd), EXPORTS_DIR);
}

/**
 * Check if metabridge is initialized
 */
export function isInitialized(cwd: string = process.cwd()): boolean {
  return fs.existsSync(getMetabridgeDir(cwd));
}

/**
 * Initialize metabridge directory structure
 */
export function initialize(cwd: string = process.cwd()): void {
  const metabridgeDir = getMetabridgeDir(cwd);
  const cacheDir = getCacheDir(cwd);
  const exportsDir = getExportsDir(cwd);

  // Create directories
  if (!fs.existsSync(metabridgeDir)) {
    fs.mkdirSync(metabridgeDir, { recursive: true });
  }
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }

  // Create default config if it doesn't exist
  const configPath = getConfigPath(cwd);
  if (!fs.existsSync(configPath)) {
    const defaultConfig: MetabridgeConfig = {
      defaults: {
        conflict_resolution: 'prompt',
      },
    };
    saveConfig(defaultConfig, cwd);
  }
}

/**
 * Load configuration from file
 */
export function loadConfig(cwd: string = process.cwd()): MetabridgeConfig {
  const configPath = getConfigPath(cwd);

  if (!fs.existsSync(configPath)) {
    return {};
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const parsed = toml.parse(content) as unknown as MetabridgeConfig;
    return parsed;
  } catch (error) {
    throw new Error(
      `Failed to parse config file: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Save configuration to file
 */
export function saveConfig(
  config: MetabridgeConfig,
  cwd: string = process.cwd()
): void {
  const configPath = getConfigPath(cwd);
  const metabridgeDir = getMetabridgeDir(cwd);

  // Ensure directory exists
  if (!fs.existsSync(metabridgeDir)) {
    fs.mkdirSync(metabridgeDir, { recursive: true });
  }

  try {
    const content = toml.stringify(config as toml.JsonMap);
    fs.writeFileSync(configPath, content, 'utf-8');
  } catch (error) {
    throw new Error(
      `Failed to save config file: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get repository configuration
 */
export function getRepository(
  cwd: string = process.cwd()
): RepositoryConfig | undefined {
  const config = loadConfig(cwd);
  return config.repository;
}

/**
 * Set repository configuration
 */
export function setRepository(
  url: string,
  options: { branch?: string; cacheTtl?: number } = {},
  cwd: string = process.cwd()
): void {
  const config = loadConfig(cwd);
  config.repository = {
    url,
    branch: options.branch || 'main',
    cache_ttl: options.cacheTtl || 3600,
  };
  saveConfig(config, cwd);
}

/**
 * Clear repository configuration
 */
export function clearRepository(cwd: string = process.cwd()): void {
  const config = loadConfig(cwd);
  delete config.repository;
  saveConfig(config, cwd);
}

/**
 * Get all store aliases
 */
export function getStores(
  cwd: string = process.cwd()
): Record<string, StoreAlias> {
  const config = loadConfig(cwd);
  return config.stores || {};
}

/**
 * Get a specific store alias
 */
export function getStore(
  alias: string,
  cwd: string = process.cwd()
): StoreAlias | undefined {
  const stores = getStores(cwd);
  return stores[alias];
}

/**
 * Add or update a store alias
 */
export function setStore(
  alias: string,
  shop: string,
  description?: string,
  cwd: string = process.cwd()
): void {
  const config = loadConfig(cwd);
  if (!config.stores) {
    config.stores = {};
  }
  config.stores[alias] = { shop, description };
  saveConfig(config, cwd);
}

/**
 * Remove a store alias
 */
export function removeStore(alias: string, cwd: string = process.cwd()): void {
  const config = loadConfig(cwd);
  if (config.stores && config.stores[alias]) {
    delete config.stores[alias];
    saveConfig(config, cwd);
  }
}

/**
 * Get default import source
 */
export function getDefaultImportSource(
  cwd: string = process.cwd()
): string | undefined {
  const config = loadConfig(cwd);
  return config.defaults?.import_source;
}

/**
 * Set default import source
 */
export function setDefaultImportSource(
  source: string,
  cwd: string = process.cwd()
): void {
  const config = loadConfig(cwd);
  if (!config.defaults) {
    config.defaults = {};
  }
  config.defaults.import_source = source;
  saveConfig(config, cwd);
}

/**
 * Get default conflict resolution strategy
 */
export function getDefaultConflictResolution(
  cwd: string = process.cwd()
): 'prompt' | 'skip' | 'overwrite' | 'abort' {
  const config = loadConfig(cwd);
  return config.defaults?.conflict_resolution || 'prompt';
}

/**
 * Set default conflict resolution strategy
 */
export function setDefaultConflictResolution(
  strategy: 'prompt' | 'skip' | 'overwrite' | 'abort',
  cwd: string = process.cwd()
): void {
  const config = loadConfig(cwd);
  if (!config.defaults) {
    config.defaults = {};
  }
  config.defaults.conflict_resolution = strategy;
  saveConfig(config, cwd);
}

/**
 * Clear cache directory
 */
export function clearCache(cwd: string = process.cwd()): void {
  const cacheDir = getCacheDir(cwd);
  if (fs.existsSync(cacheDir)) {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.mkdirSync(cacheDir, { recursive: true });
  }
}

/**
 * List all local exports
 */
export function listExports(cwd: string = process.cwd()): string[] {
  const exportsDir = getExportsDir(cwd);
  if (!fs.existsSync(exportsDir)) {
    return [];
  }

  try {
    return fs
      .readdirSync(exportsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch (error) {
    return [];
  }
}

/**
 * Get path to a specific export
 */
export function getExportPath(
  name: string,
  cwd: string = process.cwd()
): string {
  return path.join(getExportsDir(cwd), name);
}

/**
 * Check if an export exists
 */
export function exportExists(name: string, cwd: string = process.cwd()): boolean {
  return fs.existsSync(getExportPath(name, cwd));
}
