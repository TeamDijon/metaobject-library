import { minimatch } from 'minimatch';
import type {
  Manifest,
  ManifestMetaobjectEntry,
  ManifestMetafieldEntry,
  ImportOptions,
} from '../types/index.js';

/**
 * Combined definition entry (union of metaobject and metafield)
 */
export type DefinitionEntry = ManifestMetaobjectEntry | ManifestMetafieldEntry;

/**
 * Selection result
 */
export interface SelectionResult {
  selected: DefinitionEntry[];
  total: number;
  filtered: number;
}

/**
 * Check if entry is a metaobject
 */
export function isMetaobjectEntry(
  entry: DefinitionEntry
): entry is ManifestMetaobjectEntry {
  return 'type' in entry && !('resource' in entry);
}

/**
 * Check if entry is a metafield
 */
export function isMetafieldEntry(
  entry: DefinitionEntry
): entry is ManifestMetafieldEntry {
  return 'resource' in entry && 'namespace' in entry && 'key' in entry;
}

/**
 * Get definition identifier
 */
export function getDefinitionId(entry: DefinitionEntry): string {
  if (isMetaobjectEntry(entry)) {
    return entry.type;
  } else {
    return `${entry.resource}.${entry.namespace}.${entry.key}`;
  }
}

/**
 * Get definition type name (for filtering)
 */
export function getDefinitionTypeName(entry: DefinitionEntry): string {
  if (isMetaobjectEntry(entry)) {
    return entry.type;
  } else {
    return `${entry.namespace}.${entry.key}`;
  }
}

/**
 * Select definitions based on criteria
 */
export function selectDefinitions(
  manifest: Manifest,
  options: ImportOptions
): SelectionResult {
  // Combine all definitions
  const allDefinitions: DefinitionEntry[] = [
    ...manifest.metaobjects,
    ...manifest.metafields,
  ];

  let selected = allDefinitions;

  // Apply type filter
  if (options.type && options.type.length > 0) {
    selected = selected.filter((def) => {
      const typeName = getDefinitionTypeName(def);
      return options.type!.some((t) => typeName === t);
    });
  }

  // Apply category filter
  if (options.category && options.category.length > 0) {
    selected = selected.filter((def) =>
      options.category!.includes(def.category)
    );
  }

  // Apply pattern filter
  if (options.pattern) {
    const matcher = minimatch.filter(options.pattern, { nocase: true });
    selected = selected.filter((def) => {
      const typeName = getDefinitionTypeName(def);
      return matcher(typeName);
    });
  }

  // Apply exclusion filters
  if (options.excludeType && options.excludeType.length > 0) {
    selected = selected.filter((def) => {
      const typeName = getDefinitionTypeName(def);
      return !options.excludeType!.some((t) => typeName === t);
    });
  }

  if (options.excludeCategory && options.excludeCategory.length > 0) {
    selected = selected.filter(
      (def) => !options.excludeCategory!.includes(def.category)
    );
  }

  return {
    selected,
    total: allDefinitions.length,
    filtered: allDefinitions.length - selected.length,
  };
}

/**
 * Resolve dependencies for selected definitions
 */
export function resolveDependencies(
  selected: DefinitionEntry[],
  manifest: Manifest
): DefinitionEntry[] {
  const selectedIds = new Set(selected.map(getDefinitionId));
  const toProcess = [...selected];
  const result = new Set<DefinitionEntry>(selected);

  while (toProcess.length > 0) {
    const current = toProcess.shift()!;
    const currentId = getDefinitionId(current);

    // Get dependencies from dependency graph
    const deps = manifest.dependency_graph[currentId] || [];

    // Add each dependency if not already included
    for (const depId of deps) {
      if (!selectedIds.has(depId)) {
        // Find the definition entry for this dependency
        const depEntry = findDefinitionById(depId, manifest);
        if (depEntry) {
          result.add(depEntry);
          selectedIds.add(depId);
          toProcess.push(depEntry);
        }
      }
    }
  }

  return Array.from(result);
}

/**
 * Get only dependencies (exclude the selected definitions themselves)
 */
export function getDependenciesOnly(
  selected: DefinitionEntry[],
  manifest: Manifest
): DefinitionEntry[] {
  const selectedIds = new Set(selected.map(getDefinitionId));
  const allWithDeps = resolveDependencies(selected, manifest);

  return allWithDeps.filter((def) => !selectedIds.has(getDefinitionId(def)));
}

/**
 * Find a definition by its ID
 */
export function findDefinitionById(
  id: string,
  manifest: Manifest
): DefinitionEntry | undefined {
  // Check metaobjects
  const metaobject = manifest.metaobjects.find((m) => m.type === id);
  if (metaobject) {
    return metaobject;
  }

  // Check metafields (format: resource.namespace.key)
  const metafield = manifest.metafields.find((m) => {
    const fieldId = `${m.resource}.${m.namespace}.${m.key}`;
    return fieldId === id;
  });

  return metafield;
}

/**
 * Sort definitions in dependency order
 */
export function sortByDependencyOrder(
  definitions: DefinitionEntry[],
  manifest: Manifest
): DefinitionEntry[] {
  const sorted: DefinitionEntry[] = [];
  const visited = new Set<string>();
  const definitionMap = new Map(
    definitions.map((def) => [getDefinitionId(def), def])
  );

  function visit(def: DefinitionEntry) {
    const id = getDefinitionId(def);
    if (visited.has(id)) {
      return;
    }

    visited.add(id);

    // Visit dependencies first
    const deps = manifest.dependency_graph[id] || [];
    for (const depId of deps) {
      const depDef = definitionMap.get(depId);
      if (depDef && !visited.has(depId)) {
        visit(depDef);
      }
    }

    sorted.push(def);
  }

  // Visit all definitions
  definitions.forEach((def) => visit(def));

  return sorted;
}

/**
 * Get definition display name
 */
export function getDisplayName(entry: DefinitionEntry): string {
  if (isMetaobjectEntry(entry)) {
    return `Metaobject: ${entry.type}`;
  } else {
    return `Metafield: ${entry.resource}.${entry.namespace}.${entry.key}`;
  }
}

/**
 * Get definition details for display
 */
export function getDefinitionDetails(entry: DefinitionEntry): string[] {
  const details: string[] = [];

  details.push(`Category: ${entry.category}`);
  details.push(`Path: ${entry.path}`);

  if (entry.dependencies && entry.dependencies.length > 0) {
    details.push(`Dependencies: ${entry.dependencies.join(', ')}`);
  } else {
    details.push('Dependencies: None');
  }

  return details;
}
