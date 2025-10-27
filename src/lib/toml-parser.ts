import TOML from '@iarna/toml';
import type {
  MetaobjectTomlDefinition,
  MetafieldTomlDefinition,
  Manifest,
  StandardDefinitions,
  ExportMetadata,
} from '../types';

/**
 * Parse TOML string into a typed object
 * @param content - TOML string content
 * @returns Parsed TOML object
 */
export function parseTOML<T = unknown>(content: string): T {
  try {
    return TOML.parse(content) as T;
  } catch (error) {
    throw new Error(
      `Failed to parse TOML: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Convert an object to TOML string
 * @param data - Object to convert
 * @returns TOML string
 */
export function stringifyTOML(data: unknown): string {
  try {
    return TOML.stringify(data as TOML.JsonMap);
  } catch (error) {
    throw new Error(
      `Failed to stringify TOML: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Parse a metaobject TOML definition
 * @param content - TOML file content
 * @returns Parsed metaobject definition
 */
export function parseMetaobjectToml(content: string): MetaobjectTomlDefinition {
  return parseTOML<MetaobjectTomlDefinition>(content);
}

/**
 * Parse a metafield TOML definition
 * @param content - TOML file content
 * @returns Parsed metafield definition
 */
export function parseMetafieldToml(content: string): MetafieldTomlDefinition {
  return parseTOML<MetafieldTomlDefinition>(content);
}

/**
 * Parse the manifest TOML file
 * @param content - TOML file content
 * @returns Parsed manifest
 */
export function parseManifest(content: string): Manifest {
  return parseTOML<Manifest>(content);
}

/**
 * Parse standard definitions tracking file
 * @param content - TOML file content
 * @returns Parsed standard definitions
 */
export function parseStandardDefinitions(content: string): StandardDefinitions {
  return parseTOML<StandardDefinitions>(content);
}

/**
 * Parse export metadata file
 * @param content - TOML file content
 * @returns Parsed export metadata
 */
export function parseExportMetadata(content: string): ExportMetadata {
  return parseTOML<ExportMetadata>(content);
}

/**
 * Generate TOML comment header for definition files
 * @param type - Definition type
 * @param metadata - Additional metadata
 * @returns Comment string
 */
export function generateDefinitionHeader(
  type: string,
  metadata: {
    category?: string;
    version?: string;
    lastModified?: string;
    resource?: string;
  }
): string {
  const lines: string[] = [`# ${type}`];

  if (metadata.resource) {
    lines.push(`# Resource: ${metadata.resource}`);
  }
  if (metadata.category) {
    lines.push(`# Category: ${metadata.category}`);
  }
  if (metadata.version) {
    lines.push(`# Version: ${metadata.version}`);
  }
  if (metadata.lastModified) {
    lines.push(`# Last Modified: ${metadata.lastModified}`);
  }

  lines.push(''); // Empty line after header
  return lines.join('\n');
}
