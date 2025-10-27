import type {
  MetaobjectTomlDefinition,
  MetafieldTomlDefinition,
} from '../types/index.js';
import { calculateChecksum } from './checksum.js';

/**
 * Conflict resolution strategy
 */
export type ConflictStrategy = 'prompt' | 'skip' | 'overwrite' | 'abort';

/**
 * Conflict detection result
 */
export interface ConflictResult {
  hasConflict: boolean;
  reason?: string;
  checksumMatch: boolean;
}

/**
 * Detect if there's a conflict between source and existing definition
 */
export function detectConflict(
  sourceDefinition: MetaobjectTomlDefinition | MetafieldTomlDefinition,
  existingDefinition: MetaobjectTomlDefinition | MetafieldTomlDefinition | null
): ConflictResult {
  // No existing definition = no conflict
  if (!existingDefinition) {
    return {
      hasConflict: false,
      checksumMatch: false,
    };
  }

  // Calculate checksums
  const sourceChecksum = calculateChecksum(JSON.stringify(sourceDefinition));
  const existingChecksum = calculateChecksum(
    JSON.stringify(existingDefinition)
  );

  // If checksums match, no conflict (same definition)
  if (sourceChecksum === existingChecksum) {
    return {
      hasConflict: false,
      checksumMatch: true,
    };
  }

  // Checksums differ = conflict
  return {
    hasConflict: true,
    reason: 'Definition exists with different content',
    checksumMatch: false,
  };
}

/**
 * Compare two definitions and generate a diff summary
 */
export function compareDefinitions(
  source: MetaobjectTomlDefinition | MetafieldTomlDefinition,
  existing: MetaobjectTomlDefinition | MetafieldTomlDefinition
): {
  added: string[];
  removed: string[];
  modified: string[];
} {
  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];

  // For metaobjects, compare fields
  if ('fields' in source && 'fields' in existing) {
    const sourceFields = Object.keys(source.fields);
    const existingFields = Object.keys(existing.fields);

    // Find added fields
    sourceFields.forEach((field) => {
      if (!existingFields.includes(field)) {
        added.push(`Field: ${field}`);
      }
    });

    // Find removed fields
    existingFields.forEach((field) => {
      if (!sourceFields.includes(field)) {
        removed.push(`Field: ${field}`);
      }
    });

    // Find modified fields
    sourceFields.forEach((field) => {
      if (existingFields.includes(field)) {
        const sourceField = source.fields[field];
        const existingField = existing.fields[field];

        // Compare field properties
        if (JSON.stringify(sourceField) !== JSON.stringify(existingField)) {
          modified.push(`Field: ${field}`);
        }
      }
    });
  }

  // Compare definition properties
  const sourceDefStr = JSON.stringify(source.definition);
  const existingDefStr = JSON.stringify(existing.definition);

  if (sourceDefStr !== existingDefStr) {
    modified.push('Definition properties');
  }

  return { added, removed, modified };
}

/**
 * Format diff for display
 */
export function formatDiff(diff: {
  added: string[];
  removed: string[];
  modified: string[];
}): string {
  const lines: string[] = [];

  if (diff.added.length > 0) {
    lines.push('Added:');
    diff.added.forEach((item) => lines.push(`  + ${item}`));
  }

  if (diff.removed.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push('Removed:');
    diff.removed.forEach((item) => lines.push(`  - ${item}`));
  }

  if (diff.modified.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push('Modified:');
    diff.modified.forEach((item) => lines.push(`  ~ ${item}`));
  }

  if (lines.length === 0) {
    return 'No differences found';
  }

  return lines.join('\n');
}

/**
 * Get conflict resolution action
 */
export function getConflictAction(
  strategy: ConflictStrategy,
  context: {
    definitionName: string;
    interactive: boolean;
  }
): 'overwrite' | 'skip' | 'abort' {
  switch (strategy) {
    case 'overwrite':
      return 'overwrite';
    case 'skip':
      return 'skip';
    case 'abort':
      return 'abort';
    case 'prompt':
      if (!context.interactive) {
        // Default to skip in non-interactive mode
        return 'skip';
      }
      // In interactive mode, this will be handled by the interactive-import module
      return 'skip';
  }
}
