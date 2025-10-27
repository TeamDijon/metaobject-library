import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { resolveSource } from '../lib/source-resolver.js';

/**
 * Create copy command
 */
export function createCopyCommand(): Command {
  const copy = new Command('copy');
  copy
    .description('Copy export from one location to another')
    .requiredOption('--from <source>', 'Source (export name or path)')
    .requiredOption('--to <destination>', 'Destination path')
    .action(async (options: { from: string; to: string }) => {
      try {
        await runCopy(options.from, options.to);
      } catch (error) {
        console.error(
          `✗ Copy failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        process.exit(1);
      }
    });

  return copy;
}

async function runCopy(sourceName: string, destinationPath: string): Promise<void> {
  console.log('📋 Copying export...\n');

  // Resolve source
  console.log('Resolving source...');
  const source = await resolveSource(sourceName);
  console.log(`Source: ${source.displayName}\n`);

  // Resolve destination
  const destPath = path.resolve(destinationPath);

  // Check if destination exists
  if (fs.existsSync(destPath)) {
    console.error(`✗ Destination already exists: ${destPath}`);
    console.error('Please remove it first or choose a different destination.');
    process.exit(1);
  }

  // Copy directory recursively
  console.log(`Copying to: ${destPath}`);
  copyRecursive(source.path, destPath);

  console.log('✓ Copy complete\n');
  console.log('═══════════════════════════════════════════════');
  console.log(`Export copied successfully`);
  console.log(`From: ${source.path}`);
  console.log(`To:   ${destPath}`);
  console.log('═══════════════════════════════════════════════');
}

/**
 * Recursively copy directory
 */
function copyRecursive(src: string, dest: string): void {
  // Create destination directory
  fs.mkdirSync(dest, { recursive: true });

  // Read directory contents
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      // Recursively copy subdirectory
      copyRecursive(srcPath, destPath);
    } else {
      // Copy file
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
