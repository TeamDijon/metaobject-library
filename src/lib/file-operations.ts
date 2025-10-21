import fs from 'fs/promises';
import path from 'path';
import { calculateChecksum } from './checksum';
import {
  parseTOML,
  stringifyTOML,
  parseMetaobjectToml,
  parseMetafieldToml,
  parseManifest,
  generateDefinitionHeader,
} from './toml-parser';
import type {
  MetaobjectTomlDefinition,
  MetafieldTomlDefinition,
  Manifest,
} from '../types';

/**
 * Ensure a directory exists, creating it if necessary
 * @param dirPath - Directory path
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * Read a file and return its contents
 * @param filePath - Path to file
 * @returns File contents
 */
export async function readFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    throw new Error(
      `Failed to read file ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Write content to a file
 * @param filePath - Path to file
 * @param content - Content to write
 */
export async function writeFile(filePath: string, content: string): Promise<void> {
  try {
    const dir = path.dirname(filePath);
    await ensureDirectory(dir);
    await fs.writeFile(filePath, content, 'utf-8');
  } catch (error) {
    throw new Error(
      `Failed to write file ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Check if a file exists
 * @param filePath - Path to file
 * @returns True if file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read and parse a TOML file
 * @param filePath - Path to TOML file
 * @returns Parsed TOML object
 */
export async function readTomlFile<T = unknown>(filePath: string): Promise<T> {
  const content = await readFile(filePath);
  return parseTOML<T>(content);
}

/**
 * Write an object as a TOML file
 * @param filePath - Path to write to
 * @param data - Data to write
 * @param header - Optional comment header
 */
export async function writeTomlFile(
  filePath: string,
  data: unknown,
  header?: string
): Promise<void> {
  const tomlContent = stringifyTOML(data);
  const content = header ? `${header}\n${tomlContent}` : tomlContent;
  await writeFile(filePath, content);
}

/**
 * Read a metaobject TOML definition file
 * @param filePath - Path to metaobject TOML file
 * @returns Parsed metaobject definition
 */
export async function readMetaobjectDefinition(filePath: string): Promise<MetaobjectTomlDefinition> {
  const content = await readFile(filePath);
  return parseMetaobjectToml(content);
}

/**
 * Write a metaobject TOML definition file
 * @param filePath - Path to write to
 * @param definition - Metaobject definition
 * @param metadata - Metadata for header
 */
export async function writeMetaobjectDefinition(
  filePath: string,
  definition: MetaobjectTomlDefinition,
  metadata?: { category?: string; version?: string; lastModified?: string }
): Promise<void> {
  const header = generateDefinitionHeader(`Metaobject: ${definition.definition.name}`, {
    category: metadata?.category || definition.definition.category,
    version: metadata?.version,
    lastModified: metadata?.lastModified,
  });

  await writeTomlFile(filePath, definition, header);
}

/**
 * Read a metafield TOML definition file
 * @param filePath - Path to metafield TOML file
 * @returns Parsed metafield definition
 */
export async function readMetafieldDefinition(filePath: string): Promise<MetafieldTomlDefinition> {
  const content = await readFile(filePath);
  return parseMetafieldToml(content);
}

/**
 * Write a metafield TOML definition file
 * @param filePath - Path to write to
 * @param definition - Metafield definition
 * @param metadata - Metadata for header
 */
export async function writeMetafieldDefinition(
  filePath: string,
  definition: MetafieldTomlDefinition,
  metadata?: { category?: string; version?: string; lastModified?: string }
): Promise<void> {
  const header = generateDefinitionHeader(`Metafield: ${definition.definition.name}`, {
    resource: definition.definition.resource,
    category: metadata?.category || definition.definition.category,
    version: metadata?.version,
    lastModified: metadata?.lastModified,
  });

  await writeTomlFile(filePath, definition, header);
}

/**
 * Read the manifest file
 * @param manifestPath - Path to manifest.toml
 * @returns Parsed manifest
 */
export async function readManifest(manifestPath: string): Promise<Manifest> {
  const content = await readFile(manifestPath);
  return parseManifest(content);
}

/**
 * Write the manifest file
 * @param manifestPath - Path to manifest.toml
 * @param manifest - Manifest data
 */
export async function writeManifest(manifestPath: string, manifest: Manifest): Promise<void> {
  const header = `# Shopify Definitions Manifest\n# Central tracking for all definitions, versions, and dependencies\n`;
  await writeTomlFile(manifestPath, manifest, header);
}

/**
 * Read all TOML files in a directory
 * @param dirPath - Directory path
 * @returns Array of file paths
 */
export async function listTomlFiles(dirPath: string): Promise<string[]> {
  try {
    const exists = await fileExists(dirPath);
    if (!exists) {
      return [];
    }

    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Recursively list files in subdirectories
        const subFiles = await listTomlFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile() && entry.name.endsWith('.toml')) {
        files.push(fullPath);
      }
    }

    return files;
  } catch (error) {
    throw new Error(
      `Failed to list TOML files in ${dirPath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Calculate checksum for a file
 * @param filePath - Path to file
 * @returns Checksum string
 */
export async function calculateFileChecksum(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  return calculateChecksum(content);
}

/**
 * Get file modification time
 * @param filePath - Path to file
 * @returns ISO timestamp string
 */
export async function getFileModificationTime(filePath: string): Promise<string> {
  try {
    const stats = await fs.stat(filePath);
    return stats.mtime.toISOString();
  } catch (error) {
    throw new Error(
      `Failed to get modification time for ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
