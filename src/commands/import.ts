import { Command } from 'commander';
import dotenv from 'dotenv';
import path from 'path';
import readline from 'readline';
import type {
  ImportOptions,
  ShopifyConfig,
  MetaobjectTomlDefinition,
  MetafieldTomlDefinition,
  ImportResult,
  ImportSummary,
} from '../types';
import { createShopifyClient, validateConfig } from '../lib/shopify-client';
import {
  CREATE_METAOBJECT_DEFINITION_MUTATION,
  CREATE_METAFIELD_DEFINITION_MUTATION,
  METAOBJECT_DEFINITION_BY_TYPE_QUERY,
} from '../lib/queries';
import {
  readManifest,
  listTomlFiles,
  readMetaobjectDefinition,
  readMetafieldDefinition,
  fileExists,
} from '../lib/file-operations';
import { buildImportOrder, findMissingDependencies, validateDependencyGraph } from '../lib/dependency-resolver';
import { classifyDependency, parseMetafieldId, formatMetafieldId } from '../lib/standard-definitions';
import type { Manifest } from '../types';

// Load environment variables
dotenv.config();

export const importCommand = new Command('import')
  .description('Import metaobject and metafield definitions to a Shopify store')
  .option('-s, --shop <shop>', 'Shopify shop domain (e.g., mystore.myshopify.com)')
  .option('-t, --token <token>', 'Shopify Admin API access token')
  .option('-i, --input <path>', 'Input directory containing TOML files', './shopify-definitions')
  .option('--dry-run', 'Preview changes without applying them', false)
  .action(async (options: ImportOptions) => {
    try {
      await runImport(options);
    } catch (error) {
      console.error('Import failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

async function runImport(options: ImportOptions): Promise<void> {
  console.log('🚀 Starting import...\n');

  if (options.dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  // 1. Validate configuration
  const config = getConfig(options);
  validateConfig(config);

  // 2. Setup input directory
  const inputDir = path.resolve(options.input || './shopify-definitions');
  const manifestPath = path.join(inputDir, 'manifest.toml');

  if (!(await fileExists(manifestPath))) {
    throw new Error(`Manifest not found at ${manifestPath}. Please run export first.`);
  }

  console.log(`📁 Input directory: ${inputDir}\n`);

  // 3. Load manifest
  console.log('📋 Loading manifest...');
  const manifest = await readManifest(manifestPath);
  console.log(`✓ Manifest loaded (version ${manifest.manifest.version})\n`);

  // 4. Load all definitions
  console.log('📦 Loading definitions...');
  const { metaobjects, metafields } = await loadDefinitions(inputDir, manifest);
  console.log(`✓ Loaded ${metaobjects.size} metaobject(s) and ${metafields.size} metafield(s)\n`);

  // 5. Validate dependencies
  console.log('🔗 Validating dependencies...');
  const availableDefinitions = new Set([...metaobjects.keys(), ...metafields.keys()]);
  const validation = validateDependencyGraph(manifest.dependency_graph, availableDefinitions);

  if (!validation.valid) {
    console.error('❌ Dependency validation failed:');
    validation.errors.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  }

  if (validation.warnings.length > 0) {
    console.warn('⚠️  Warnings:');
    validation.warnings.forEach((warn) => console.warn(`  - ${warn}`));
    console.log('');
  }

  console.log('✓ Dependencies validated\n');

  // 6. Create Shopify client
  const client = createShopifyClient(config);

  // 7. Check existing definitions
  console.log('🔍 Checking existing definitions in target store...');
  const existingMetaobjects = await checkExistingMetaobjects(client, metaobjects);
  console.log(`✓ Found ${existingMetaobjects.size} existing metaobject(s)\n`);

  // 8. Show dry run summary and exit if dry run
  if (options.dryRun) {
    await showDryRunSummary(manifest, metaobjects, metafields, existingMetaobjects);
    return;
  }

  // 9. Perform import
  console.log('📥 Importing definitions...\n');
  const summary = await performImport(
    client,
    manifest,
    metaobjects,
    metafields,
    existingMetaobjects,
    inputDir
  );

  // 10. Show summary
  showImportSummary(summary);
}

function getConfig(options: ImportOptions): ShopifyConfig {
  return {
    shop: options.shop || process.env.SHOPIFY_SHOP || '',
    accessToken: options.token || process.env.SHOPIFY_ACCESS_TOKEN || '',
    apiVersion: process.env.SHOPIFY_API_VERSION,
  };
}

async function loadDefinitions(
  inputDir: string,
  manifest: Manifest
): Promise<{
  metaobjects: Map<string, MetaobjectTomlDefinition>;
  metafields: Map<string, MetafieldTomlDefinition>;
}> {
  const metaobjects = new Map<string, MetaobjectTomlDefinition>();
  const metafields = new Map<string, MetafieldTomlDefinition>();

  // Load metaobjects
  for (const entry of manifest.metaobjects) {
    const filePath = path.join(inputDir, entry.path);
    const definition = await readMetaobjectDefinition(filePath);
    metaobjects.set(entry.type, definition);
  }

  // Load metafields
  for (const entry of manifest.metafields) {
    const filePath = path.join(inputDir, entry.path);
    const definition = await readMetafieldDefinition(filePath);
    const id = formatMetafieldId(entry.resource, entry.namespace, entry.key);
    metafields.set(id, definition);
  }

  return { metaobjects, metafields };
}

async function checkExistingMetaobjects(
  client: any,
  metaobjects: Map<string, MetaobjectTomlDefinition>
): Promise<Set<string>> {
  const existing = new Set<string>();

  for (const type of metaobjects.keys()) {
    try {
      const response: any = await client.request(METAOBJECT_DEFINITION_BY_TYPE_QUERY, { type });
      if (response.metaobjectDefinitionByType) {
        existing.add(type);
      }
    } catch (error) {
      // Definition doesn't exist, which is fine
    }
  }

  return existing;
}

async function showDryRunSummary(
  manifest: Manifest,
  metaobjects: Map<string, MetaobjectTomlDefinition>,
  metafields: Map<string, MetafieldTomlDefinition>,
  existingMetaobjects: Set<string>
): Promise<void> {
  console.log('═══════════════════════════════════════════════');
  console.log('Dry Run Summary');
  console.log('═══════════════════════════════════════════════\n');

  console.log(`Total definitions to import: ${metaobjects.size + metafields.size}\n`);

  console.log('Import Order:\n');
  console.log('Metaobjects:');
  for (const type of manifest.import_order.metaobjects) {
    const status = existingMetaobjects.has(type) ? 'CONFLICT (exists)' : 'NEW';
    console.log(`  ${manifest.import_order.metaobjects.indexOf(type) + 1}. ${type} - ${status}`);
  }

  console.log('\nMetafields:');
  for (const id of manifest.import_order.metafields) {
    console.log(`  ${manifest.import_order.metafields.indexOf(id) + 1}. ${id} - NEW`);
  }

  if (existingMetaobjects.size > 0) {
    console.log(`\n⚠️  ${existingMetaobjects.size} definition(s) already exist (would prompt for action)`);
  }

  console.log('\n═══════════════════════════════════════════════');
}

async function performImport(
  client: any,
  manifest: Manifest,
  metaobjects: Map<string, MetaobjectTomlDefinition>,
  metafields: Map<string, MetafieldTomlDefinition>,
  existingMetaobjects: Set<string>,
  inputDir: string
): Promise<ImportSummary> {
  const results: ImportResult[] = [];
  let skipAll = false;
  let continueAll = false;

  // Import metaobjects
  for (const type of manifest.import_order.metaobjects) {
    const definition = metaobjects.get(type);
    if (!definition) continue;

    // Check if exists
    if (existingMetaobjects.has(type)) {
      if (!skipAll && !continueAll) {
        const action = await promptForConflict(type, 'metaobject');
        if (action === 'skip_all') {
          skipAll = true;
        } else if (action === 'continue_all') {
          continueAll = true;
        } else if (action === 'skip') {
          results.push({
            definition: type,
            type: 'metaobject',
            status: 'skipped',
            reason: 'Already exists (user chose to skip)',
          });
          continue;
        } else if (action === 'abort') {
          console.log('\n❌ Import aborted by user');
          break;
        }
      }

      if (skipAll) {
        results.push({
          definition: type,
          type: 'metaobject',
          status: 'skipped',
          reason: 'Already exists (skip all)',
        });
        continue;
      }
    }

    // Import the definition
    const result = await importMetaobject(client, definition);
    results.push(result);

    if (result.status === 'success') {
      console.log(`  ✓ ${type}`);
    } else {
      console.log(`  ✗ ${type}: ${result.error}`);
    }
  }

  // Import metafields
  for (const id of manifest.import_order.metafields) {
    const definition = metafields.get(id);
    if (!definition) continue;

    const result = await importMetafield(client, definition);
    results.push(result);

    if (result.status === 'success') {
      console.log(`  ✓ ${id}`);
    } else {
      console.log(`  ✗ ${id}: ${result.error}`);
    }
  }

  // Calculate summary
  const summary: ImportSummary = {
    total: results.length,
    successful: results.filter((r) => r.status === 'success').length,
    failed: results.filter((r) => r.status === 'failed').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    results,
    standard_definitions_enabled: 0,
  };

  return summary;
}

async function promptForConflict(
  definitionId: string,
  type: string
): Promise<'skip' | 'overwrite' | 'skip_all' | 'continue_all' | 'abort'> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log(`\n⚠️  Conflict detected`);
    console.log(`Definition: ${definitionId} (${type})`);
    console.log(`Status: Already exists in target store\n`);
    console.log('Options:');
    console.log('  [S] Skip (keep existing definition)');
    console.log('  [O] Overwrite (replace with local definition)');
    console.log('  [A] Skip all conflicts');
    console.log('  [C] Continue all (overwrite all conflicts)');
    console.log('  [X] Abort import\n');

    rl.question('Choice: ', (answer) => {
      rl.close();
      const choice = answer.toLowerCase().trim();

      switch (choice) {
        case 's':
          resolve('skip');
          break;
        case 'o':
          resolve('overwrite');
          break;
        case 'a':
          resolve('skip_all');
          break;
        case 'c':
          resolve('continue_all');
          break;
        case 'x':
          resolve('abort');
          break;
        default:
          console.log('Invalid choice, skipping...');
          resolve('skip');
      }
    });
  });
}

async function importMetaobject(
  client: any,
  definition: MetaobjectTomlDefinition
): Promise<ImportResult> {
  try {
    // Build field definitions
    const fieldDefinitions = Object.entries(definition.fields).map(([key, field]) => ({
      key,
      name: field.name,
      description: field.description,
      type: field.type,
      required: field.required,
      validations: field.validations || [],
    }));

    // Build input for mutation
    const input = {
      type: definition.definition.type,
      name: definition.definition.name,
      description: definition.definition.description,
      displayNameKey: definition.definition.display_name_field,
      access: {
        admin: definition.definition.access?.admin || 'MERCHANT_READ_WRITE',
        storefront: definition.definition.access?.storefront || 'NONE',
      },
      capabilities: {
        translatable: definition.definition.capabilities?.translatable
          ? { enabled: true }
          : undefined,
        publishable: definition.definition.capabilities?.publishable
          ? { enabled: true }
          : undefined,
      },
      fieldDefinitions,
    };

    const response: any = await client.request(CREATE_METAOBJECT_DEFINITION_MUTATION, {
      definition: input,
    });

    if (response.metaobjectDefinitionCreate.userErrors?.length > 0) {
      const errors = response.metaobjectDefinitionCreate.userErrors;
      return {
        definition: definition.definition.type,
        type: 'metaobject',
        status: 'failed',
        error: errors.map((e: any) => e.message).join(', '),
      };
    }

    return {
      definition: definition.definition.type,
      type: 'metaobject',
      status: 'success',
    };
  } catch (error) {
    return {
      definition: definition.definition.type,
      type: 'metaobject',
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function importMetafield(
  client: any,
  definition: MetafieldTomlDefinition
): Promise<ImportResult> {
  try {
    // Map resource name to owner type
    const ownerType = mapResourceToOwnerType(definition.definition.resource);

    // Build input for mutation
    const input = {
      namespace: definition.definition.namespace,
      key: definition.definition.key,
      name: definition.definition.name,
      description: definition.definition.description,
      type: definition.definition.type,
      ownerType,
      access: {
        admin: definition.definition.access?.admin,
        storefront: definition.definition.access?.storefront,
      },
    };

    const response: any = await client.request(CREATE_METAFIELD_DEFINITION_MUTATION, {
      definition: input,
    });

    if (response.metafieldDefinitionCreate.userErrors?.length > 0) {
      const errors = response.metafieldDefinitionCreate.userErrors;
      const defId = `${definition.definition.resource}.${definition.definition.namespace}.${definition.definition.key}`;
      return {
        definition: defId,
        type: 'metafield',
        status: 'failed',
        error: errors.map((e: any) => e.message).join(', '),
      };
    }

    const defId = `${definition.definition.resource}.${definition.definition.namespace}.${definition.definition.key}`;
    return {
      definition: defId,
      type: 'metafield',
      status: 'success',
    };
  } catch (error) {
    const defId = `${definition.definition.resource}.${definition.definition.namespace}.${definition.definition.key}`;
    return {
      definition: defId,
      type: 'metafield',
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function mapResourceToOwnerType(resource: string): string {
  const mapping: Record<string, string> = {
    product: 'PRODUCT',
    variant: 'PRODUCTVARIANT',
    collection: 'COLLECTION',
    customer: 'CUSTOMER',
    order: 'ORDER',
    shop: 'SHOP',
    article: 'ARTICLE',
    blog: 'BLOG',
    page: 'PAGE',
    location: 'LOCATION',
  };

  return mapping[resource.toLowerCase()] || resource.toUpperCase();
}

function showImportSummary(summary: ImportSummary): void {
  console.log('\n═══════════════════════════════════════════════');
  console.log('Import Summary');
  console.log('═══════════════════════════════════════════════\n');

  console.log(`✓ Successfully Imported: ${summary.successful} definition(s)`);
  const successful = summary.results.filter((r) => r.status === 'success');
  for (const result of successful) {
    console.log(`  - ${result.definition} (${result.type})`);
  }

  if (summary.failed > 0) {
    console.log(`\n⚠️  Failed Imports: ${summary.failed} definition(s)`);
    const failed = summary.results.filter((r) => r.status === 'failed');
    for (const result of failed) {
      console.log(`  - ${result.definition} (${result.type})`);
      console.log(`    Reason: ${result.error}`);
    }
  }

  if (summary.skipped > 0) {
    console.log(`\n⏭  Skipped by User: ${summary.skipped} definition(s)`);
    const skipped = summary.results.filter((r) => r.status === 'skipped');
    for (const result of skipped) {
      console.log(`  - ${result.definition} (${result.type})`);
      console.log(`    Reason: ${result.reason}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════');
}
