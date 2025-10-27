import { Command } from 'commander';
import path from 'path';
import { resolveSource } from '../lib/source-resolver.js';
import { readManifest } from '../lib/file-operations.js';
import {
  getDefinitionId,
  isMetaobjectEntry,
  type DefinitionEntry,
} from '../lib/definition-selector.js';

/**
 * Create diff command
 */
export function createDiffCommand(): Command {
  const diff = new Command('diff');
  diff
    .description('Compare definitions between two sources')
    .requiredOption('--source1 <source>', 'First source (repo, export name, or path)')
    .requiredOption('--source2 <source>', 'Second source (repo, export name, or path)')
    .action(async (options: { source1: string; source2: string }) => {
      try {
        await runDiff(options.source1, options.source2);
      } catch (error) {
        console.error(
          `✗ Diff failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        process.exit(1);
      }
    });

  return diff;
}

async function runDiff(source1Name: string, source2Name: string): Promise<void> {
  console.log('📊 Comparing sources...\n');

  // Resolve both sources
  console.log('Resolving sources...');
  const source1 = await resolveSource(source1Name);
  const source2 = await resolveSource(source2Name);

  console.log(`Source 1: ${source1.displayName}`);
  console.log(`Source 2: ${source2.displayName}\n`);

  // Load manifests
  const manifest1Path = path.join(source1.path, 'manifest.toml');
  const manifest2Path = path.join(source2.path, 'manifest.toml');

  const manifest1 = await readManifest(manifest1Path);
  const manifest2 = await readManifest(manifest2Path);

  // Create sets of definition IDs
  const defs1 = new Map<string, DefinitionEntry>();
  const defs2 = new Map<string, DefinitionEntry>();

  [...manifest1.metaobjects, ...manifest1.metafields].forEach((def) => {
    defs1.set(getDefinitionId(def), def);
  });

  [...manifest2.metaobjects, ...manifest2.metafields].forEach((def) => {
    defs2.set(getDefinitionId(def), def);
  });

  // Find added, removed, and common definitions
  const allIds = new Set([...defs1.keys(), ...defs2.keys()]);
  const added: string[] = [];
  const removed: string[] = [];
  const common: Array<{ id: string; checksumMatch: boolean }> = [];

  allIds.forEach((id) => {
    const inSource1 = defs1.has(id);
    const inSource2 = defs2.has(id);

    if (inSource1 && !inSource2) {
      removed.push(id);
    } else if (!inSource1 && inSource2) {
      added.push(id);
    } else if (inSource1 && inSource2) {
      const def1 = defs1.get(id)!;
      const def2 = defs2.get(id)!;
      const checksumMatch = def1.checksum === def2.checksum;
      common.push({ id, checksumMatch });
    }
  });

  // Display results
  console.log('═══════════════════════════════════════════════');
  console.log('Diff Summary');
  console.log('═══════════════════════════════════════════════\n');

  console.log(`Source 1: ${defs1.size} definitions`);
  console.log(`Source 2: ${defs2.size} definitions\n`);

  if (added.length > 0) {
    console.log(`✨ Added in Source 2 (${added.length}):`);
    added.forEach((id) => {
      const def = defs2.get(id)!;
      const type = isMetaobjectEntry(def) ? 'metaobject' : 'metafield';
      console.log(`  + ${id} (${type})`);
    });
    console.log('');
  }

  if (removed.length > 0) {
    console.log(`🗑  Removed from Source 2 (${removed.length}):`);
    removed.forEach((id) => {
      const def = defs1.get(id)!;
      const type = isMetaobjectEntry(def) ? 'metaobject' : 'metafield';
      console.log(`  - ${id} (${type})`);
    });
    console.log('');
  }

  const modified = common.filter((c) => !c.checksumMatch);
  const unchanged = common.filter((c) => c.checksumMatch);

  if (modified.length > 0) {
    console.log(`📝 Modified (${modified.length}):`);
    modified.forEach((c) => {
      const def = defs1.get(c.id)!;
      const type = isMetaobjectEntry(def) ? 'metaobject' : 'metafield';
      console.log(`  ~ ${c.id} (${type})`);
    });
    console.log('');
  }

  if (unchanged.length > 0) {
    console.log(`✓ Unchanged (${unchanged.length}):`);
    unchanged.forEach((c) => {
      const def = defs1.get(c.id)!;
      const type = isMetaobjectEntry(def) ? 'metaobject' : 'metafield';
      console.log(`  = ${c.id} (${type})`);
    });
    console.log('');
  }

  console.log('═══════════════════════════════════════════════');
  console.log('\nSummary:');
  console.log(`  Added: ${added.length}`);
  console.log(`  Removed: ${removed.length}`);
  console.log(`  Modified: ${modified.length}`);
  console.log(`  Unchanged: ${unchanged.length}`);
  console.log('═══════════════════════════════════════════════');
}
