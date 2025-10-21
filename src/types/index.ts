/**
 * Shopify store configuration
 */
export interface ShopifyConfig {
  shop: string;
  accessToken: string;
  apiVersion?: string;
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
  validations?: Record<string, unknown>[];
}

/**
 * Metaobject definition structure
 */
export interface MetaobjectDefinition {
  type: string;
  name: string;
  description?: string;
  fieldDefinitions: MetaobjectFieldDefinition[];
  access?: {
    admin?: string;
    storefront?: string;
  };
  displayNameKey?: string;
}

/**
 * CLI export options
 */
export interface ExportOptions {
  shop?: string;
  token?: string;
  output?: string;
  type?: string;
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
