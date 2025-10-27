import path from 'path';
import {
  readManifest,
  writeManifest,
  fileExists,
  calculateFileChecksum,
  getFileModificationTime,
} from './file-operations';
import { buildDependencyGraph, buildImportOrder, getAllDependencies } from './dependency-resolver';
import type {
  Manifest,
  ManifestMetaobjectEntry,
  ManifestMetafieldEntry,
  MetaobjectTomlDefinition,
  MetafieldTomlDefinition,
} from '../types';

const TOOL_VERSION = '0.1.0';
const SCHEMA_VERSION = '1';

/**
 * Create an empty manifest
 * @returns Empty manifest structure
 */
export function createEmptyManifest(): Manifest {
  return {
    manifest: {
      version: '0.0.0',
      schema_version: SCHEMA_VERSION,
      last_updated: new Date().toISOString(),
      tool_version: TOOL_VERSION,
    },
    metaobjects: [],
    metafields: [],
    dependency_graph: {},
    import_order: {
      metaobjects: [],
      metafields: [],
    },
  };
}

/**
 * Load manifest from file, or create empty if doesn't exist
 * @param manifestPath - Path to manifest.toml
 * @returns Loaded or empty manifest
 */
export async function loadOrCreateManifest(manifestPath: string): Promise<Manifest> {
  const exists = await fileExists(manifestPath);
  if (!exists) {
    return createEmptyManifest();
  }

  try {
    return await readManifest(manifestPath);
  } catch (error) {
    console.warn(
      `Failed to load manifest, creating new one: ${error instanceof Error ? error.message : String(error)}`
    );
    return createEmptyManifest();
  }
}

/**
 * Create a manifest entry for a metaobject
 * @param type - Metaobject type
 * @param definition - Metaobject definition
 * @param filePath - Path to the TOML file
 * @param checksum - File checksum
 * @param category - Category for organization
 * @returns Manifest entry
 */
export async function createMetaobjectEntry(
  type: string,
  definition: MetaobjectTomlDefinition,
  filePath: string,
  checksum: string,
  category: string
): Promise<ManifestMetaobjectEntry> {
  const lastModified = await getFileModificationTime(filePath);
  const dependencies = getAllDependencies(definition.dependencies);

  return {
    type,
    category: definition.definition.category || category,
    path: filePath,
    version: '1.0.0', // TODO: Implement semantic versioning
    last_modified: lastModified,
    checksum,
    dependencies,
  };
}

/**
 * Create a manifest entry for a metafield
 * @param resource - Resource type
 * @param namespace - Metafield namespace
 * @param key - Metafield key
 * @param definition - Metafield definition
 * @param filePath - Path to the TOML file
 * @param checksum - File checksum
 * @param category - Category for organization
 * @returns Manifest entry
 */
export async function createMetafieldEntry(
  resource: string,
  namespace: string,
  key: string,
  definition: MetafieldTomlDefinition,
  filePath: string,
  checksum: string,
  category: string
): Promise<ManifestMetafieldEntry> {
  const lastModified = await getFileModificationTime(filePath);
  const dependencies = getAllDependencies(definition.dependencies);

  return {
    resource,
    namespace,
    key,
    category: definition.definition.category || category,
    path: filePath,
    version: '1.0.0', // TODO: Implement semantic versioning
    last_modified: lastModified,
    checksum,
    dependencies,
  };
}

/**
 * Update manifest with new definitions
 * @param manifest - Current manifest
 * @param metaobjects - Map of metaobject definitions with their file paths
 * @param metafields - Map of metafield definitions with their file paths
 * @returns Updated manifest
 */
export async function updateManifest(
  manifest: Manifest,
  metaobjects: Map<
    string,
    { definition: MetaobjectTomlDefinition; filePath: string; category: string }
  >,
  metafields: Map<
    string,
    { definition: MetafieldTomlDefinition; filePath: string; category: string }
  >
): Promise<Manifest> {
  const newManifest: Manifest = {
    manifest: {
      version: incrementVersion(manifest.manifest.version),
      schema_version: SCHEMA_VERSION,
      last_updated: new Date().toISOString(),
      tool_version: TOOL_VERSION,
    },
    metaobjects: [],
    metafields: [],
    dependency_graph: {},
    import_order: {
      metaobjects: [],
      metafields: [],
    },
  };

  // Build metaobject entries
  for (const [type, { definition, filePath, category }] of metaobjects) {
    const checksum = await calculateFileChecksum(filePath);
    const entry = await createMetaobjectEntry(type, definition, filePath, checksum, category);
    newManifest.metaobjects.push(entry);
  }

  // Build metafield entries
  for (const [id, { definition, filePath, category }] of metafields) {
    const checksum = await calculateFileChecksum(filePath);
    const { resource, namespace, key } = definition.definition;
    const entry = await createMetafieldEntry(
      resource,
      namespace,
      key,
      definition,
      filePath,
      checksum,
      category
    );
    newManifest.metafields.push(entry);
  }

  // Build dependency graph
  const metaobjectDefs = new Map<string, MetaobjectTomlDefinition>();
  for (const [type, { definition }] of metaobjects) {
    metaobjectDefs.set(type, definition);
  }

  const metafieldDefs = new Map<string, MetafieldTomlDefinition>();
  for (const [id, { definition }] of metafields) {
    metafieldDefs.set(id, definition);
  }

  newManifest.dependency_graph = buildDependencyGraph(metaobjectDefs, metafieldDefs);

  // Build import order
  newManifest.import_order = buildImportOrder(metaobjectDefs, metafieldDefs);

  return newManifest;
}

/**
 * Save manifest to file
 * @param manifestPath - Path to manifest.toml
 * @param manifest - Manifest to save
 */
export async function saveManifest(manifestPath: string, manifest: Manifest): Promise<void> {
  await writeManifest(manifestPath, manifest);
}

/**
 * Increment manifest version (semantic versioning)
 * @param currentVersion - Current version string
 * @returns Incremented version
 */
function incrementVersion(currentVersion: string): string {
  const parts = currentVersion.split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    return '1.0.0';
  }

  const [major, minor, patch] = parts;
  // For now, just increment patch version
  // TODO: Implement logic to determine major/minor/patch increments
  return `${major}.${minor}.${patch + 1}`;
}

/**
 * Get relative path from base directory
 * @param basePath - Base directory path
 * @param filePath - Full file path
 * @returns Relative path
 */
export function getRelativePath(basePath: string, filePath: string): string {
  return path.relative(basePath, filePath).replace(/\\/g, '/');
}
