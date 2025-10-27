#!/usr/bin/env node

import { Command } from 'commander';
import { exportCommand } from './commands/export.js';
import { importCommand } from './commands/import.js';
import { createConfigCommand } from './commands/config.js';
import { createInitCommand } from './commands/init.js';
import { createSyncCommand } from './commands/sync.js';
import { createSourcesCommand } from './commands/sources.js';
import { createDiffCommand } from './commands/diff.js';
import { createCopyCommand } from './commands/copy.js';
import { config } from 'dotenv';

// Load environment variables
config();

const program = new Command();

program
  .name('metabridge')
  .description('CLI tool for bridging Shopify metaobject and metafield definitions between stores')
  .version('0.1.0');

// Register commands
program.addCommand(createInitCommand());
program.addCommand(createConfigCommand());
program.addCommand(createSyncCommand());
program.addCommand(createSourcesCommand());
program.addCommand(createDiffCommand());
program.addCommand(createCopyCommand());
program.addCommand(exportCommand);
program.addCommand(importCommand);

// Parse arguments
program.parse(process.argv);
