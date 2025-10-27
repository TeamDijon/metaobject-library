import { Command } from 'commander';
import * as configManager from '../lib/config-manager.js';
import { listAvailableSources } from '../lib/source-resolver.js';

/**
 * Create sources command
 */
export function createSourcesCommand(): Command {
  const sources = new Command('sources');
  sources.description('Manage and list available definition sources');

  // List sources
  sources
    .command('list')
    .description('List all available sources')
    .action(() => {
      try {
        // Check if initialized
        if (!configManager.isInitialized()) {
          console.log('Metabridge not initialized in this project');
          console.log('Run "metabridge init" to get started');
          return;
        }

        const sources = listAvailableSources();

        if (sources.length === 0) {
          console.log('No sources available');
          console.log('\nTo get started:');
          console.log('  • Configure a repository: metabridge config set-repo <url>');
          console.log('  • Export from a store: metabridge export --shop <domain>');
          return;
        }

        console.log('Available Sources:\n');

        // Group by type
        const repositories = sources.filter((s) => s.type === 'repository');
        const exports = sources.filter((s) => s.type === 'local_export');

        if (repositories.length > 0) {
          console.log('📦 Repository:');
          repositories.forEach((source) => {
            console.log(`  ${source.name}`);
            console.log(`    ${source.details}`);
          });
          console.log('');
        }

        if (exports.length > 0) {
          console.log('📁 Local Exports:');
          exports.forEach((source) => {
            console.log(`  ${source.name} (${source.details})`);
          });
          console.log('');
        }

        console.log('Usage:');
        console.log('  metabridge import --from <source>');
        console.log('  metabridge import --from repo          (use repository)');
        console.log('  metabridge import --from <export-name> (use local export)');
      } catch (error) {
        console.error(
          `✗ Failed to list sources: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        process.exit(1);
      }
    });

  return sources;
}
