/**
 * Shopify store configuration
 */
export interface ShopifyConfig {
  shop: string;
  accessToken: string;
  apiVersion?: string;
}

/**
 * Field validation rule
 */
export interface FieldValidation {
  name: string;
  value: string | number | boolean;
}

/**
 * Metaobject field definition
 */
export interface MetaobjectFieldDefinition {
  key: string;
  name: string;
  description?: string;
  type: string;
  required?: boolean;
  validations?: FieldValidation[];
}

/**
 * Access configuration for metaobjects and metafields
 */
export interface AccessConfig {
  admin?: string;
  storefront?: string;
}

/**
 * Capabilities configuration for metaobjects
 */
export interface CapabilitiesConfig {
  translatable?: boolean;
  publishable?: boolean;
  renderable?: boolean;
}

/**
 * Dependencies declaration
 */
export interface DependenciesConfig {
  metaobjects?: string[];
  metafields?: string[];
  standard_metafields?: string[];
  standard_metaobjects?: string[];
}

/**
 * Metaobject definition structure (from API)
 */
export interface MetaobjectDefinition {
  type: string;
  name: string;
  description?: string;
  fieldDefinitions: MetaobjectFieldDefinition[];
  access?: AccessConfig;
  displayNameKey?: string;
  capabilities?: CapabilitiesConfig;
}

/**
 * Metaobject TOML definition structure
 */
export interface MetaobjectTomlDefinition {
  definition: {
    type: string;
    name: string;
    description?: string;
    display_name_field?: string;
    category?: string;
    access?: AccessConfig;
    capabilities?: CapabilitiesConfig;
  };
  fields: {
    [key: string]: {
      name: string;
      type: string;
      required?: boolean;
      description?: string;
      validations?: FieldValidation[];
    };
  };
  dependencies?: DependenciesConfig;
}

/**
 * Metafield definition structure (from API)
 */
export interface MetafieldDefinition {
  namespace: string;
  key: string;
  name: string;
  description?: string;
  type: string;
  resource: string;
  validations?: FieldValidation[];
  access?: AccessConfig;
}

/**
 * Metafield TOML definition structure
 */
export interface MetafieldTomlDefinition {
  definition: {
    namespace: string;
    key: string;
    name: string;
    description?: string;
    type: string;
    resource: string;
    category?: string;
    access?: AccessConfig;
    validations?: Record<string, unknown>;
  };
  dependencies?: DependenciesConfig;
}

/**
 * Manifest entry for a metaobject
 */
export interface ManifestMetaobjectEntry {
  type: string;
  category: string;
  path: string;
  version: string;
  last_modified: string;
  checksum: string;
  dependencies: string[];
}

/**
 * Manifest entry for a metafield
 */
export interface ManifestMetafieldEntry {
  resource: string;
  namespace: string;
  key: string;
  category: string;
  path: string;
  version: string;
  last_modified: string;
  checksum: string;
  dependencies: string[];
}

/**
 * Dependency graph structure
 */
export interface DependencyGraph {
  [definitionId: string]: string[];
}

/**
 * Import order structure
 */
export interface ImportOrder {
  metaobjects: string[];
  metafields: string[];
}

/**
 * Manifest structure
 */
export interface Manifest {
  manifest: {
    version: string;
    schema_version: string;
    last_updated: string;
    tool_version: string;
  };
  metaobjects: ManifestMetaobjectEntry[];
  metafields: ManifestMetafieldEntry[];
  dependency_graph: DependencyGraph;
  import_order: ImportOrder;
}

/**
 * Standard metafield definition
 */
export interface StandardMetafieldDefinition {
  template_id: string;
  namespace: string;
  key: string;
  resource: string;
  name: string;
  enabled_at: string;
}

/**
 * Standard metaobject definition
 */
export interface StandardMetaobjectDefinition {
  template_id: string;
  type: string;
  name: string;
  enabled_at: string;
}

/**
 * Standard definitions tracking
 */
export interface StandardDefinitions {
  enabled: StandardMetafieldDefinition[] | StandardMetaobjectDefinition[];
}

/**
 * Export metadata entry
 */
export interface ExportMetadataEntry {
  type: 'metaobject' | 'metafield';
  name?: string;
  resource?: string;
  namespace?: string;
  key?: string;
  category?: string;
  fields_count?: number;
  checksum: string;
}

/**
 * Export metadata structure
 */
export interface ExportMetadata {
  export: {
    timestamp: string;
    source_store: string;
    api_version: string;
    tool_version: string;
    counts: {
      metaobjects: number;
      metafields: number;
      total: number;
    };
  };
  definitions: ExportMetadataEntry[];
}

/**
 * CLI export options
 */
export interface ExportOptions {
  shop?: string;
  token?: string;
  output?: string;
  type?: string;
  category?: string;
}

/**
 * CLI import options
 */
export interface ImportOptions {
  shop?: string;
  token?: string;
  input?: string;
  dryRun?: boolean;
}

/**
 * Dependency type classification
 */
export enum DependencyType {
  CUSTOM_METAOBJECT = 'custom_metaobject',
  CUSTOM_METAFIELD = 'custom_metafield',
  STANDARD_METAFIELD = 'standard_metafield',
  STANDARD_METAOBJECT = 'standard_metaobject',
}

/**
 * Dependency reference
 */
export interface DependencyReference {
  id: string;
  type: DependencyType;
  exists: boolean;
  enabled?: boolean; // For standard definitions
}

/**
 * Import result for a single definition
 */
export interface ImportResult {
  definition: string;
  type: 'metaobject' | 'metafield';
  status: 'success' | 'failed' | 'skipped';
  reason?: string;
  error?: string;
}

/**
 * Import summary
 */
export interface ImportSummary {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  results: ImportResult[];
  standard_definitions_enabled: number;
}
