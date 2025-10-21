import type { DependencyType } from '../types';

/**
 * Standard metafield namespace patterns
 * Based on Shopify's standard definitions
 */
const STANDARD_METAFIELD_NAMESPACES = [
  'descriptors',
  'facts',
  'reviews',
  'shopify--discovery--product_recommendation',
  'shopify--discovery--product_search_boost',
  'import_information',
] as const;

/**
 * Standard metaobject types
 * Based on Shopify's standard definitions
 */
const STANDARD_METAOBJECT_TYPES = ['product_review'] as const;

/**
 * Check if a namespace belongs to a standard metafield definition
 * @param namespace - Metafield namespace
 * @returns True if standard definition
 */
export function isStandardMetafieldNamespace(namespace: string): boolean {
  return STANDARD_METAFIELD_NAMESPACES.some((prefix) => namespace.startsWith(prefix));
}

/**
 * Check if a type belongs to a standard metaobject definition
 * @param type - Metaobject type
 * @returns True if standard definition
 */
export function isStandardMetaobjectType(type: string): boolean {
  return STANDARD_METAOBJECT_TYPES.includes(type as typeof STANDARD_METAOBJECT_TYPES[number]);
}

/**
 * Parse a dependency reference from a metafield type
 * Extracts the referenced type from types like:
 * - metaobject_reference<$app:typeface>
 * - list.metaobject_reference<$app:product_specs>
 * @param fieldType - The metafield type string
 * @returns Referenced type or null if no reference
 */
export function parseMetaobjectReference(fieldType: string): string | null {
  const match = fieldType.match(/metaobject_reference<\$app:([^>]+)>/);
  return match ? match[1] : null;
}

/**
 * Extract all metaobject references from a field type
 * @param fieldType - The metafield type string
 * @returns Array of referenced metaobject types
 */
export function extractMetaobjectReferences(fieldType: string): string[] {
  const references: string[] = [];
  const ref = parseMetaobjectReference(fieldType);
  if (ref) {
    references.push(ref);
  }
  return references;
}

/**
 * Classify a dependency by its identifier
 * @param dependencyId - The dependency identifier
 * @returns Dependency type classification
 */
export function classifyDependency(dependencyId: string): DependencyType {
  // Check if it's a metafield reference (contains namespace separator)
  if (dependencyId.includes('.')) {
    const [namespace] = dependencyId.split('.');
    if (isStandardMetafieldNamespace(namespace)) {
      return 'standard_metafield' as DependencyType;
    }
    return 'custom_metafield' as DependencyType;
  }

  // Check if it's a standard metaobject
  if (isStandardMetaobjectType(dependencyId)) {
    return 'standard_metaobject' as DependencyType;
  }

  // Default to custom metaobject
  return 'custom_metaobject' as DependencyType;
}

/**
 * Format a metafield identifier for dependency tracking
 * @param resource - Resource type (product, variant, etc.)
 * @param namespace - Metafield namespace
 * @param key - Metafield key
 * @returns Formatted identifier
 */
export function formatMetafieldId(resource: string, namespace: string, key: string): string {
  return `${resource}.${namespace}.${key}`;
}

/**
 * Parse a metafield identifier back into components
 * @param metafieldId - Formatted metafield identifier
 * @returns Components or null if invalid
 */
export function parseMetafieldId(
  metafieldId: string
): { resource: string; namespace: string; key: string } | null {
  const parts = metafieldId.split('.');
  if (parts.length !== 3) {
    return null;
  }
  const [resource, namespace, key] = parts;
  return { resource, namespace, key };
}
