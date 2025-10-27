import { Command } from 'commander';
import * as configManager from '../lib/config-manager.js';

/**
 * Create init command
 */
export function createInitCommand(): Command {
  const init = new Command('init');
  init
    .description('Initialize metabridge in the current project')
    .action(() => {
      try {
        if (configManager.isInitialized()) {
          console.log('⚠ Metabridge is already initialized in this project');
          console.log(
            `\nConfiguration directory: ${configManager.getMetabridgeDir()}`
          );
          return;
        }

        configManager.initialize();
        console.log('✓ Metabridge initialized successfully\n');
        console.log('Created directories:');
        console.log(`  ${configManager.getMetabridgeDir()}`);
        console.log(`  ${configManager.getCacheDir()}`);
        console.log(`  ${configManager.getExportsDir()}`);
        console.log(`\nConfiguration file: ${configManager.getConfigPath()}`);
        console.log(
          '\nNext steps:'
        );
        console.log(
          '  1. Configure a repository: metabridge config set-repo <url>'
        );
        console.log('  2. Import definitions: metabridge import --from repo');
        console.log(
          '  3. Or export from a store: metabridge export --shop <domain>'
        );
      } catch (error) {
        console.error(
          `✗ Failed to initialize: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        process.exit(1);
      }
    });

  return init;
}
