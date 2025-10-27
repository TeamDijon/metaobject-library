import { Command } from 'commander';
import dotenv from 'dotenv';
import path from 'path';
import type {
  ImportOptions,
  ShopifyConfig,
  MetaobjectTomlDefinition,
  MetafieldTomlDefinition,
  ImportResult,
  ImportSummary,
  Manifest,
} from '../types/index.js';
import { createShopifyClient, validateConfig } from '../lib/shopify-client.js';
import {
  CREATE_METAOBJECT_DEFINITION_MUTATION,
  CREATE_METAFIELD_DEFINITION_MUTATION,
  METAOBJECT_DEFINITION_BY_TYPE_QUERY,
} from '../lib/queries.js';
import {
  readManifest,
  readMetaobjectDefinition,
  readMetafieldDefinition,
  fileExists,
} from '../lib/file-operations.js';
import {
  validateDependencyGraph,
} from '../lib/dependency-resolver.js';
import * as configManager from '../lib/config-manager.js';
import { resolveSource } from '../lib/source-resolver.js';
import {
  selectDefinitions,
  resolveDependencies,
  getDependenciesOnly,
  sortByDependencyOrder,
  getDefinitionId,
  isMetaobjectEntry,
  type DefinitionEntry,
} from '../lib/definition-selector.js';
import {
  reviewAllDefinitions,
  type ReviewContext,
  type DefinitionAction,
} from '../lib/interactive-import.js';
import {
  detectConflict,
  type ConflictStrategy,
} from '../lib/conflict-resolver.js';

// Load environment variables
dotenv.config();

export const importCommand = new Command('import')
  .description('Import metaobject and metafield definitions to a Shopify store')
  .option('-s, --shop <shop>', 'Shopify shop domain (e.g., mystore.myshopify.com)')
  .option('-t, --token <token>', 'Shopify Admin API access token')
  .option('-i, --input <path>', 'Input directory containing TOML files (deprecated, use --from)')
  .option('-f, --from <source>', 'Source: "repo", export name, or filesystem path')
  .option('--type <types...>', 'Import specific definition types')
  .option('--category <categories...>', 'Import specific categories')
  .option('--pattern <pattern>', 'Import definitions matching glob pattern')
  .option('--exclude-type <types...>', 'Exclude specific types')
  .option('--exclude-category <categories...>', 'Exclude specific categories')
  .option('--all', 'Import all definitions without interactive prompts')
  .option('--with-dependencies', 'Include dependencies of selected definitions')
  .option('--dependencies-only', 'Only import dependencies (not the selected definitions)')
  .option('--no-dependencies', 'Skip dependency resolution')
  .option('--interactive', 'Force interactive review even with --type')
  .option('--no-interactive', 'No interactive prompts, use --on-conflict strategy')
  .option('--on-conflict <strategy>', 'Conflict resolution: prompt, skip, overwrite, abort', 'prompt')
  .option('--to <alias>', 'Target store alias (from config)')
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

  // 1. Resolve source
  const from = options.from || options.input;
  if (!from) {
    const repo = configManager.getRepository();
    if (!repo) {
      throw new Error(
        'No source specified. Use --from <source> or configure a repository with "metabridge config set-repo"'
      );
    }
    options.from = 'repo';
  }

  console.log('📦 Resolving source...');
  const source = await resolveSource(options.from!, {
    force: false,
  });
  console.log(`✓ Source: ${source.displayName}`);
  if (source.cacheAge !== undefined) {
    const age = Math.floor(source.cacheAge / 60);
    console.log(`  Cache age: ${age} minutes`);
  }
  console.log('');

  // 2. Load manifest from source
  const manifestPath = path.join(source.path, 'manifest.toml');
  if (!(await fileExists(manifestPath))) {
    throw new Error(`Manifest not found at ${manifestPath}`);
  }

  console.log('📋 Loading manifest...');
  const manifest = await readManifest(manifestPath);
  console.log(`✓ Manifest loaded (version ${manifest.manifest.version})\n`);

  // 3. Select definitions based on criteria
  console.log('🎯 Selecting definitions...');
  let selection = selectDefinitions(manifest, options);

  // Handle --all flag
  if (options.all && selection.selected.length === 0) {
    selection.selected = [...manifest.metaobjects, ...manifest.metafields];
  }

  // Apply dependency resolution
  if (options.withDependencies) {
    const withDeps = resolveDependencies(selection.selected, manifest);
    console.log(`✓ Selected ${selection.selected.length} definitions + ${withDeps.length - selection.selected.length} dependencies`);
    selection.selected = withDeps;
  } else if (options.dependenciesOnly) {
    const depsOnly = getDependenciesOnly(selection.selected, manifest);
    console.log(`✓ Selected ${depsOnly.length} dependencies`);
    selection.selected = depsOnly;
  } else if (options.noDependencies === false) {
    // Default: include dependencies
    selection.selected = resolveDependencies(selection.selected, manifest);
  }

  if (selection.selected.length === 0) {
    console.log('⚠️  No definitions selected. Nothing to import.');
    return;
  }

  console.log(`✓ Selected ${selection.selected.length} definition(s)\n`);

  // 4. Sort by dependency order
  const sorted = sortByDependencyOrder(selection.selected, manifest);

  // 5. Validate configuration
  const config = getConfig(options);
  validateConfig(config);

  // 6. Create Shopify client
  const client = createShopifyClient(config);

  // 7. Load definitions and check for conflicts
  console.log('📦 Loading definitions and checking conflicts...');
  const contexts: ReviewContext[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    const filePath = path.join(source.path, entry.path);

    let sourceData: MetaobjectTomlDefinition | MetafieldTomlDefinition;
    let existingData: MetaobjectTomlDefinition | MetafieldTomlDefinition | null = null;

    // Load source definition
    if (isMetaobjectEntry(entry)) {
      sourceData = await readMetaobjectDefinition(filePath);
      // Check if exists in store
      try {
        const response: any = await client.request(
          METAOBJECT_DEFINITION_BY_TYPE_QUERY,
          { type: entry.type }
        );
        if (response.metaobjectDefinitionByType) {
          // Would need to convert API response to TOML format for comparison
          // For now, just mark as existing
          existingData = sourceData; // Placeholder
        }
      } catch (error) {
        // Doesn't exist
      }
    } else {
      sourceData = await readMetafieldDefinition(filePath);
      // Metafields are harder to check, assume new for now
    }

    contexts.push({
      definition: entry,
      sourceData,
      existingData,
      index: i,
      total: sorted.length,
    });
  }

  console.log(`✓ Loaded ${contexts.length} definition(s)\n`);

  // 8. Handle dry-run
  if (options.dryRun) {
    showDryRunSummary(contexts);
    return;
  }

  // 9. Interactive review or automatic import
  let decisions: Map<string, DefinitionAction>;

  const shouldBeInteractive =
    !options.noInteractive &&
    (options.interactive || !options.all) &&
    options.onConflict === 'prompt';

  if (shouldBeInteractive) {
    console.log('🔍 Starting interactive review...\n');
    try {
      decisions = await reviewAllDefinitions(contexts);
    } catch (error) {
      if (error instanceof Error && error.message.includes('aborted')) {
        console.log('\n❌ Import aborted by user');
        return;
      }
      throw error;
    }
  } else {
    // Automatic mode - apply conflict strategy
    decisions = new Map();
    const strategy = options.onConflict as ConflictStrategy;

    for (const context of contexts) {
      const definitionId = getDefinitionId(context.definition);
      const conflict = detectConflict(context.sourceData, context.existingData);

      if (!conflict.hasConflict || conflict.checksumMatch) {
        decisions.set(definitionId, 'import');
      } else {
        // Has conflict
        switch (strategy) {
          case 'overwrite':
            decisions.set(definitionId, 'overwrite');
            break;
          case 'skip':
            decisions.set(definitionId, 'skip');
            break;
          case 'abort':
            throw new Error(`Conflict detected for ${definitionId}. Aborting due to --on-conflict abort`);
          default:
            decisions.set(definitionId, 'skip');
        }
      }
    }
  }

  // 10. Perform import
  console.log('\n📥 Importing definitions...\n');
  const summary = await performImport(client, contexts, decisions);

  // 11. Show summary
  showImportSummary(summary);
}

function getConfig(options: ImportOptions): ShopifyConfig {
  // Check if using store alias
  if (options.to) {
    const store = configManager.getStore(options.to);
    if (!store) {
      throw new Error(`Store alias "${options.to}" not found. Use "metabridge config list-stores" to see available aliases.`);
    }
    return {
      shop: store.shop,
      accessToken: options.token || process.env.SHOPIFY_ACCESS_TOKEN || '',
      apiVersion: process.env.SHOPIFY_API_VERSION,
    };
  }

  return {
    shop: options.shop || process.env.SHOPIFY_SHOP || '',
    accessToken: options.token || process.env.SHOPIFY_ACCESS_TOKEN || '',
    apiVersion: process.env.SHOPIFY_API_VERSION,
  };
}

function showDryRunSummary(contexts: ReviewContext[]): void {
  console.log('═══════════════════════════════════════════════');
  console.log('Dry Run Summary');
  console.log('═══════════════════════════════════════════════\n');

  console.log(`Total definitions to import: ${contexts.length}\n`);

  console.log('Definitions:\n');
  contexts.forEach((context, index) => {
    const definitionId = getDefinitionId(context.definition);
    const conflict = detectConflict(context.sourceData, context.existingData);
    let status = 'NEW';
    if (conflict.checksumMatch) {
      status = 'IDENTICAL (skip)';
    } else if (conflict.hasConflict) {
      status = 'CONFLICT (exists)';
    }
    console.log(`  ${index + 1}. ${definitionId} - ${status}`);
  });

  const conflicts = contexts.filter(c =>
    detectConflict(c.sourceData, c.existingData).hasConflict
  );

  if (conflicts.length > 0) {
    console.log(`\n⚠️  ${conflicts.length} conflict(s) detected (would prompt for action)`);
  }

  console.log('\n═══════════════════════════════════════════════');
}

async function performImport(
  client: any,
  contexts: ReviewContext[],
  decisions: Map<string, DefinitionAction>
): Promise<ImportSummary> {
  const results: ImportResult[] = [];

  for (const context of contexts) {
    const definitionId = getDefinitionId(context.definition);
    const action = decisions.get(definitionId);

    if (action === 'skip') {
      results.push({
        definition: definitionId,
        type: isMetaobjectEntry(context.definition) ? 'metaobject' : 'metafield',
        status: 'skipped',
        reason: 'Skipped by user',
      });
      console.log(`  ⊘ ${definitionId} (skipped)`);
      continue;
    }

    // Import the definition
    let result: ImportResult;
    if (isMetaobjectEntry(context.definition)) {
      result = await importMetaobject(client, context.sourceData as MetaobjectTomlDefinition);
    } else {
      result = await importMetafield(client, context.sourceData as MetafieldTomlDefinition);
    }

    results.push(result);

    if (result.status === 'success') {
      console.log(`  ✓ ${definitionId}`);
    } else {
      console.log(`  ✗ ${definitionId}: ${result.error}`);
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
  if (successful.length > 0) {
    for (const result of successful) {
      console.log(`  - ${result.definition} (${result.type})`);
    }
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
    console.log(`\n⏭  Skipped: ${summary.skipped} definition(s)`);
    const skipped = summary.results.filter((r) => r.status === 'skipped');
    for (const result of skipped) {
      console.log(`  - ${result.definition} (${result.type})`);
      if (result.reason) {
        console.log(`    Reason: ${result.reason}`);
      }
    }
  }

  console.log('\n═══════════════════════════════════════════════');
}
