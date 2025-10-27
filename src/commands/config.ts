import { Command } from 'commander';
import * as configManager from '../lib/config-manager.js';

/**
 * Create config command
 */
export function createConfigCommand(): Command {
  const config = new Command('config');
  config.description('Manage metabridge configuration');

  // Set repository
  config
    .command('set-repo')
    .description('Set the remote repository URL for definitions')
    .argument('<url>', 'Repository URL (e.g., https://github.com/org/repo)')
    .option('-b, --branch <branch>', 'Git branch to use', 'main')
    .option('--cache-ttl <seconds>', 'Cache TTL in seconds', '3600')
    .action((url: string, options: { branch: string; cacheTtl: string }) => {
      try {
        configManager.initialize();
        configManager.setRepository(url, {
          branch: options.branch,
          cacheTtl: parseInt(options.cacheTtl, 10),
        });
        console.log(`✓ Repository configured: ${url}`);
        console.log(`  Branch: ${options.branch}`);
        console.log(`  Cache TTL: ${options.cacheTtl}s`);
      } catch (error) {
        console.error(
          `✗ Failed to set repository: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        process.exit(1);
      }
    });

  // Get repository
  config
    .command('get-repo')
    .description('Show the configured repository')
    .action(() => {
      try {
        const repo = configManager.getRepository();
        if (!repo) {
          console.log('No repository configured');
          console.log(
            '\nUse "metabridge config set-repo <url>" to configure one'
          );
          return;
        }
        console.log('Repository Configuration:');
        console.log(`  URL: ${repo.url}`);
        console.log(`  Branch: ${repo.branch || 'main'}`);
        console.log(`  Cache TTL: ${repo.cache_ttl || 3600}s`);
      } catch (error) {
        console.error(
          `✗ Failed to get repository: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        process.exit(1);
      }
    });

  // Clear repository
  config
    .command('clear-repo')
    .description('Remove repository configuration')
    .action(() => {
      try {
        configManager.clearRepository();
        console.log('✓ Repository configuration cleared');
      } catch (error) {
        console.error(
          `✗ Failed to clear repository: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        process.exit(1);
      }
    });

  // Add store alias
  config
    .command('add-store')
    .description('Add a store alias')
    .argument('<alias>', 'Alias name (e.g., production, staging)')
    .requiredOption('-s, --shop <shop>', 'Shop domain')
    .option('-d, --description <description>', 'Store description')
    .action(
      (
        alias: string,
        options: { shop: string; description?: string }
      ) => {
        try {
          configManager.initialize();
          configManager.setStore(alias, options.shop, options.description);
          console.log(`✓ Store alias "${alias}" added`);
          console.log(`  Shop: ${options.shop}`);
          if (options.description) {
            console.log(`  Description: ${options.description}`);
          }
        } catch (error) {
          console.error(
            `✗ Failed to add store: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
          process.exit(1);
        }
      }
    );

  // Remove store alias
  config
    .command('remove-store')
    .description('Remove a store alias')
    .argument('<alias>', 'Alias name to remove')
    .action((alias: string) => {
      try {
        configManager.removeStore(alias);
        console.log(`✓ Store alias "${alias}" removed`);
      } catch (error) {
        console.error(
          `✗ Failed to remove store: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        process.exit(1);
      }
    });

  // List stores
  config
    .command('list-stores')
    .description('List all store aliases')
    .action(() => {
      try {
        const stores = configManager.getStores();
        const aliases = Object.keys(stores);

        if (aliases.length === 0) {
          console.log('No store aliases configured');
          console.log(
            '\nUse "metabridge config add-store <alias> --shop <domain>" to add one'
          );
          return;
        }

        console.log('Store Aliases:');
        aliases.forEach((alias) => {
          const store = stores[alias];
          console.log(`\n  ${alias}:`);
          console.log(`    Shop: ${store.shop}`);
          if (store.description) {
            console.log(`    Description: ${store.description}`);
          }
        });
      } catch (error) {
        console.error(
          `✗ Failed to list stores: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        process.exit(1);
      }
    });

  // Clear cache
  config
    .command('clear-cache')
    .description('Clear the repository cache')
    .action(() => {
      try {
        configManager.clearCache();
        console.log('✓ Cache cleared');
      } catch (error) {
        console.error(
          `✗ Failed to clear cache: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        process.exit(1);
      }
    });

  // Show config
  config
    .command('show')
    .description('Show current configuration')
    .action(() => {
      try {
        const config = configManager.loadConfig();

        console.log('Metabridge Configuration:');
        console.log('========================\n');

        // Repository
        if (config.repository) {
          console.log('Repository:');
          console.log(`  URL: ${config.repository.url}`);
          console.log(`  Branch: ${config.repository.branch || 'main'}`);
          console.log(`  Cache TTL: ${config.repository.cache_ttl || 3600}s`);
        } else {
          console.log('Repository: Not configured');
        }

        // Stores
        console.log('\nStore Aliases:');
        if (config.stores && Object.keys(config.stores).length > 0) {
          Object.entries(config.stores).forEach(([alias, store]) => {
            console.log(`  ${alias}: ${store.shop}`);
            if (store.description) {
              console.log(`    ${store.description}`);
            }
          });
        } else {
          console.log('  None');
        }

        // Defaults
        console.log('\nDefaults:');
        console.log(
          `  Import Source: ${config.defaults?.import_source || 'Not set'}`
        );
        console.log(
          `  Conflict Resolution: ${config.defaults?.conflict_resolution || 'prompt'}`
        );

        // Paths
        console.log('\nPaths:');
        console.log(`  Config: ${configManager.getConfigPath()}`);
        console.log(`  Cache: ${configManager.getCacheDir()}`);
        console.log(`  Exports: ${configManager.getExportsDir()}`);
      } catch (error) {
        console.error(
          `✗ Failed to show config: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        process.exit(1);
      }
    });

  return config;
}
