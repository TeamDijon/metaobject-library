import { Command } from 'commander';
import dotenv from 'dotenv';
import path from 'path';
import type {
  ExportOptions,
  ShopifyConfig,
  MetaobjectDefinition,
  MetafieldDefinition,
} from '../types';
import { createShopifyClient, validateConfig } from '../lib/shopify-client';
import {
  METAOBJECT_DEFINITIONS_QUERY,
  METAFIELD_DEFINITIONS_QUERY,
  METAFIELD_OWNER_TYPES,
  type MetafieldOwnerType,
} from '../lib/queries';
import {
  writeMetaobjectDefinition,
  writeMetafieldDefinition,
  ensureDirectory,
} from '../lib/file-operations';
import {
  loadOrCreateManifest,
  updateManifest,
  saveManifest,
  getRelativePath,
} from '../lib/manifest';
import { extractMetaobjectReferences } from '../lib/standard-definitions';
import type { MetaobjectTomlDefinition, MetafieldTomlDefinition } from '../types';

// Load environment variables
dotenv.config();

export const exportCommand = new Command('export')
  .description('Export metaobject and metafield definitions from a Shopify store')
  .option('-s, --shop <shop>', 'Shopify shop domain (e.g., mystore.myshopify.com)')
  .option('-t, --token <token>', 'Shopify Admin API access token')
  .option('-o, --output <path>', 'Output directory for TOML files', './shopify-definitions')
  .option('--type <type>', 'Export only a specific metaobject type')
  .option('--category <category>', 'Default category for organization', 'general')
  .action(async (options: ExportOptions) => {
    try {
      await runExport(options);
    } catch (error) {
      console.error('Export failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

async function runExport(options: ExportOptions): Promise<void> {
  console.log('🚀 Starting export...\n');

  // 1. Validate configuration
  const config = getConfig(options);
  validateConfig(config);

  // 2. Create Shopify client
  const client = createShopifyClient(config);

  // 3. Setup output directory
  const outputDir = path.resolve(options.output || './shopify-definitions');
  await ensureDirectory(outputDir);

  console.log(`📁 Output directory: ${outputDir}\n`);

  // 4. Export metaobjects
  console.log('📦 Exporting metaobject definitions...');
  const metaobjects = await exportMetaobjects(client, outputDir, options);
  console.log(`✓ Exported ${metaobjects.size} metaobject definition(s)\n`);

  // 5. Export metafields
  console.log('🏷️  Exporting metafield definitions...');
  const metafields = await exportMetafields(client, outputDir, options);
  console.log(`✓ Exported ${metafields.size} metafield definition(s)\n`);

  // 6. Update manifest
  console.log('📋 Updating manifest...');
  const manifestPath = path.join(outputDir, 'manifest.toml');
  const manifest = await loadOrCreateManifest(manifestPath);
  const updatedManifest = await updateManifest(manifest, metaobjects, metafields);
  await saveManifest(manifestPath, updatedManifest);
  console.log(`✓ Manifest updated (version ${updatedManifest.manifest.version})\n`);

  // 7. Summary
  const totalDefinitions = metaobjects.size + metafields.size;
  console.log('═══════════════════════════════════════════════');
  console.log('Export Complete!');
  console.log('═══════════════════════════════════════════════');
  console.log(`Total definitions exported: ${totalDefinitions}`);
  console.log(`  - Metaobjects: ${metaobjects.size}`);
  console.log(`  - Metafields: ${metafields.size}`);
  console.log(`\n📁 Location: ${outputDir}`);
  console.log('═══════════════════════════════════════════════\n');
}

function getConfig(options: ExportOptions): ShopifyConfig {
  return {
    shop: options.shop || process.env.SHOPIFY_SHOP || '',
    accessToken: options.token || process.env.SHOPIFY_ACCESS_TOKEN || '',
    apiVersion: process.env.SHOPIFY_API_VERSION,
  };
}

async function exportMetaobjects(
  client: any,
  outputDir: string,
  options: ExportOptions
): Promise<
  Map<string, { definition: MetaobjectTomlDefinition; filePath: string; category: string }>
> {
  const metaobjectsDir = path.join(outputDir, 'metaobjects');
  const category = options.category || 'general';
  const categoryDir = path.join(metaobjectsDir, category);
  await ensureDirectory(categoryDir);

  const metaobjects = new Map();
  let hasNextPage = true;
  let after: string | null = null;

  while (hasNextPage) {
    const response: any = await client.request(METAOBJECT_DEFINITIONS_QUERY, {
      first: 50,
      after,
    });

    const edges = response.metaobjectDefinitions.edges;

    for (const edge of edges) {
      const node = edge.node;

      // Skip if filtering by type and doesn't match
      if (options.type && node.type !== options.type) {
        continue;
      }

      // Convert API response to TOML definition
      const tomlDef = convertMetaobjectToToml(node, category);

      // Write to file
      const fileName = `${node.type}.toml`;
      const filePath = path.join(categoryDir, fileName);
      const relativePath = getRelativePath(outputDir, filePath);

      await writeMetaobjectDefinition(filePath, tomlDef, {
        category,
        version: '1.0.0',
        lastModified: new Date().toISOString(),
      });

      metaobjects.set(node.type, {
        definition: tomlDef,
        filePath: relativePath,
        category,
      });

      console.log(`  ✓ ${node.type}`);
    }

    hasNextPage = response.metaobjectDefinitions.pageInfo.hasNextPage;
    after = response.metaobjectDefinitions.pageInfo.endCursor;
  }

  return metaobjects;
}

async function exportMetafields(
  client: any,
  outputDir: string,
  options: ExportOptions
): Promise<
  Map<string, { definition: MetafieldTomlDefinition; filePath: string; category: string }>
> {
  const metafieldsDir = path.join(outputDir, 'metafields');
  const category = options.category || 'general';
  const metafields = new Map();

  // Export metafields for each resource type
  for (const ownerType of METAFIELD_OWNER_TYPES) {
    const resourceMetafields = await exportMetafieldsForResource(
      client,
      ownerType,
      metafieldsDir,
      category,
      outputDir
    );

    for (const [id, data] of resourceMetafields) {
      metafields.set(id, data);
    }
  }

  return metafields;
}

async function exportMetafieldsForResource(
  client: any,
  ownerType: MetafieldOwnerType,
  metafieldsDir: string,
  category: string,
  outputDir: string
): Promise<
  Map<string, { definition: MetafieldTomlDefinition; filePath: string; category: string }>
> {
  const metafields = new Map();
  const resourceName = ownerType.toLowerCase().replace('productvariant', 'variant');
  const resourceDir = path.join(metafieldsDir, resourceName);
  await ensureDirectory(resourceDir);

  let hasNextPage = true;
  let after: string | null = null;

  while (hasNextPage) {
    const response: any = await client.request(METAFIELD_DEFINITIONS_QUERY, {
      ownerType,
      first: 50,
      after,
    });

    const edges = response.metafieldDefinitions.edges;

    for (const edge of edges) {
      const node = edge.node;

      // Convert API response to TOML definition
      const tomlDef = convertMetafieldToToml(node, resourceName, category);

      // Write to file
      const fileName = `${node.key}.toml`;
      const filePath = path.join(resourceDir, fileName);
      const relativePath = getRelativePath(outputDir, filePath);

      await writeMetafieldDefinition(filePath, tomlDef, {
        category,
        version: '1.0.0',
        lastModified: new Date().toISOString(),
      });

      const metafieldId = `${resourceName}.${node.namespace}.${node.key}`;
      metafields.set(metafieldId, {
        definition: tomlDef,
        filePath: relativePath,
        category,
      });

      console.log(`  ✓ ${resourceName}.${node.namespace}.${node.key}`);
    }

    hasNextPage = response.metafieldDefinitions.pageInfo.hasNextPage;
    after = response.metafieldDefinitions.pageInfo.endCursor;
  }

  return metafields;
}

function convertMetaobjectToToml(apiDefinition: any, category: string): MetaobjectTomlDefinition {
  const tomlDef: MetaobjectTomlDefinition = {
    definition: {
      type: apiDefinition.type,
      name: apiDefinition.name,
      description: apiDefinition.description || undefined,
      display_name_field: apiDefinition.displayNameKey || undefined,
      category,
      access: {
        admin: apiDefinition.access?.admin || undefined,
        storefront: apiDefinition.access?.storefront || undefined,
      },
      capabilities: {
        translatable: apiDefinition.capabilities?.translatable?.enabled || false,
        publishable: apiDefinition.capabilities?.publishable?.enabled || false,
        renderable: apiDefinition.capabilities?.renderable?.enabled || false,
      },
    },
    fields: {},
    dependencies: {
      metaobjects: [],
      metafields: [],
      standard_metafields: [],
      standard_metaobjects: [],
    },
  };

  // Convert fields
  for (const field of apiDefinition.fieldDefinitions) {
    tomlDef.fields[field.key] = {
      name: field.name,
      type: field.type.name,
      required: field.required || false,
      description: field.description || undefined,
      validations: field.validations || undefined,
    };
  }

  return tomlDef;
}

function convertMetafieldToToml(
  apiDefinition: any,
  resource: string,
  category: string
): MetafieldTomlDefinition {
  // Extract metaobject references from type
  const fieldType = apiDefinition.type.name;
  const metaobjectRefs = extractMetaobjectReferences(fieldType);

  const tomlDef: MetafieldTomlDefinition = {
    definition: {
      namespace: apiDefinition.namespace,
      key: apiDefinition.key,
      name: apiDefinition.name,
      description: apiDefinition.description || undefined,
      type: fieldType,
      resource,
      category,
      access: {
        admin: apiDefinition.access?.admin || undefined,
        storefront: apiDefinition.access?.storefront || undefined,
      },
    },
    dependencies: {
      metaobjects: metaobjectRefs,
      metafields: [],
      standard_metafields: [],
      standard_metaobjects: [],
    },
  };

  return tomlDef;
}
