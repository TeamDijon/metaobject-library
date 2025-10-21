import type {
  DependencyGraph,
  DependenciesConfig,
  MetaobjectTomlDefinition,
  MetafieldTomlDefinition,
  ImportOrder,
} from '../types';
import { classifyDependency, formatMetafieldId } from './standard-definitions';

/**
 * Build a dependency graph from definitions
 * @param metaobjects - Map of metaobject type to definition
 * @param metafields - Map of metafield ID to definition
 * @returns Dependency graph
 */
export function buildDependencyGraph(
  metaobjects: Map<string, MetaobjectTomlDefinition>,
  metafields: Map<string, MetafieldTomlDefinition>
): DependencyGraph {
  const graph: DependencyGraph = {};

  // Add metaobject dependencies
  for (const [type, definition] of metaobjects) {
    const deps = getAllDependencies(definition.dependencies);
    graph[type] = deps;
  }

  // Add metafield dependencies
  for (const [id, definition] of metafields) {
    const deps = getAllDependencies(definition.dependencies);
    graph[id] = deps;
  }

  return graph;
}

/**
 * Get all dependencies from a dependencies config
 * Combines all dependency types into a single array
 * @param dependencies - Dependencies configuration
 * @returns Array of all dependency IDs
 */
export function getAllDependencies(dependencies?: DependenciesConfig): string[] {
  if (!dependencies) {
    return [];
  }

  return [
    ...(dependencies.metaobjects || []),
    ...(dependencies.metafields || []),
    ...(dependencies.standard_metafields || []),
    ...(dependencies.standard_metaobjects || []),
  ];
}

/**
 * Separate custom and standard dependencies
 * @param dependencies - Dependencies configuration
 * @returns Object with custom and standard dependencies
 */
export function separateDependencies(dependencies?: DependenciesConfig): {
  custom: string[];
  standard: string[];
} {
  if (!dependencies) {
    return { custom: [], standard: [] };
  }

  const custom = [...(dependencies.metaobjects || []), ...(dependencies.metafields || [])];

  const standard = [
    ...(dependencies.standard_metafields || []),
    ...(dependencies.standard_metaobjects || []),
  ];

  return { custom, standard };
}

/**
 * Topological sort using depth-first search
 * Orders definitions so dependencies come before dependents
 * @param graph - Dependency graph
 * @returns Sorted array of definition IDs
 * @throws Error if circular dependency detected
 */
export function topologicalSort(graph: DependencyGraph): string[] {
  const sorted: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(node: string, path: string[] = []): void {
    if (visiting.has(node)) {
      const cycle = [...path, node].join(' -> ');
      throw new Error(`Circular dependency detected: ${cycle}`);
    }

    if (visited.has(node)) {
      return;
    }

    visiting.add(node);
    const currentPath = [...path, node];

    const dependencies = graph[node] || [];
    for (const dep of dependencies) {
      // Only visit dependencies that are in the graph
      // (skip external/standard dependencies)
      if (graph[dep]) {
        visit(dep, currentPath);
      }
    }

    visiting.delete(node);
    visited.add(node);
    sorted.push(node);
  }

  // Visit all nodes
  for (const node of Object.keys(graph)) {
    if (!visited.has(node)) {
      visit(node);
    }
  }

  return sorted;
}

/**
 * Build import order from definitions
 * Separates metaobjects and metafields and sorts each
 * @param metaobjects - Map of metaobject type to definition
 * @param metafields - Map of metafield ID to definition
 * @returns Import order with separate arrays for metaobjects and metafields
 */
export function buildImportOrder(
  metaobjects: Map<string, MetaobjectTomlDefinition>,
  metafields: Map<string, MetafieldTomlDefinition>
): ImportOrder {
  const graph = buildDependencyGraph(metaobjects, metafields);
  const sorted = topologicalSort(graph);

  const metaobjectTypes = new Set(metaobjects.keys());
  const metafieldIds = new Set(metafields.keys());

  const importOrder: ImportOrder = {
    metaobjects: [],
    metafields: [],
  };

  // Separate sorted items into metaobjects and metafields
  for (const id of sorted) {
    if (metaobjectTypes.has(id)) {
      importOrder.metaobjects.push(id);
    } else if (metafieldIds.has(id)) {
      importOrder.metafields.push(id);
    }
  }

  return importOrder;
}

/**
 * Find missing dependencies
 * @param graph - Dependency graph
 * @param availableDefinitions - Set of available definition IDs
 * @returns Map of definition ID to missing dependencies
 */
export function findMissingDependencies(
  graph: DependencyGraph,
  availableDefinitions: Set<string>
): Map<string, string[]> {
  const missing = new Map<string, string[]>();

  for (const [definitionId, dependencies] of Object.entries(graph)) {
    const missingDeps = dependencies.filter((dep) => {
      // Check if dependency is available (either in definitions or is a standard definition)
      const isAvailable = availableDefinitions.has(dep);
      const isStandard = classifyDependency(dep).includes('standard');

      // Missing if not available and not standard (standard deps are handled separately)
      return !isAvailable && !isStandard;
    });

    if (missingDeps.length > 0) {
      missing.set(definitionId, missingDeps);
    }
  }

  return missing;
}

/**
 * Validate dependency graph for cycles and missing dependencies
 * @param graph - Dependency graph
 * @param availableDefinitions - Set of available definition IDs
 * @returns Validation result
 */
export function validateDependencyGraph(
  graph: DependencyGraph,
  availableDefinitions: Set<string>
): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for circular dependencies
  try {
    topologicalSort(graph);
  } catch (error) {
    if (error instanceof Error) {
      errors.push(error.message);
    }
  }

  // Check for missing dependencies
  const missing = findMissingDependencies(graph, availableDefinitions);
  for (const [definitionId, missingDeps] of missing) {
    warnings.push(
      `Definition '${definitionId}' has missing dependencies: ${missingDeps.join(', ')}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
