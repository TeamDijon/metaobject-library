import { Command } from 'commander';
import * as configManager from '../lib/config-manager.js';
import * as remoteFetcher from '../lib/remote-fetcher.js';
import { formatCacheAge } from '../lib/source-resolver.js';

/**
 * Create sync command
 */
export function createSyncCommand(): Command {
  const sync = new Command('sync');
  sync
    .description('Update repository cache from remote')
    .option('-f, --force', 'Force update even if cache is fresh')
    .action(async (options: { force?: boolean }) => {
      try {
        // Check if initialized
        if (!configManager.isInitialized()) {
          console.error(
            '✗ Metabridge not initialized. Run "metabridge init" first.'
          );
          process.exit(1);
        }

        // Check if repository is configured
        const repo = configManager.getRepository();
        if (!repo) {
          console.error('✗ No repository configured');
          console.log(
            '\nUse "metabridge config set-repo <url>" to configure one'
          );
          process.exit(1);
        }

        // Show current cache status
        const info = remoteFetcher.getRepositoryInfo(repo.url);
        console.log('Repository Cache Status:');
        console.log(`  URL: ${repo.url}`);
        console.log(`  Branch: ${repo.branch || 'main'}`);
        console.log(`  Cached: ${info.cached ? 'Yes' : 'No'}`);

        if (info.cached) {
          console.log(`  Age: ${formatCacheAge(info.age)}`);
          console.log(
            `  Status: ${info.stale ? '⚠ Stale' : '✓ Fresh'}`
          );
        }

        // Check if update is needed
        if (!options.force && info.cached && !info.stale) {
          console.log(
            '\nCache is fresh. Use --force to update anyway.'
          );
          return;
        }

        console.log('');

        // Fetch/update repository
        await remoteFetcher.fetchConfiguredRepository({
          force: true,
        });

        console.log('✓ Repository cache synchronized');
      } catch (error) {
        console.error(
          `✗ Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        process.exit(1);
      }
    });

  return sync;
}
