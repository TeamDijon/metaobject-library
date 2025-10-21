#!/usr/bin/env node

import { Command } from 'commander';
import { exportCommand } from './commands/export';
import { importCommand } from './commands/import';
import { config } from 'dotenv';

// Load environment variables
config();

const program = new Command();

program
  .name('metaobject')
  .description('CLI tool for migrating Shopify metaobject definitions between stores')
  .version('0.1.0');

// Register commands
program.addCommand(exportCommand);
program.addCommand(importCommand);

// Parse arguments
program.parse(process.argv);
