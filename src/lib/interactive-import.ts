import inquirer from 'inquirer';
import type {
  MetaobjectTomlDefinition,
  MetafieldTomlDefinition,
} from '../types/index.js';
import type { DefinitionEntry } from './definition-selector.js';
import {
  getDisplayName,
  getDefinitionDetails,
  isMetaobjectEntry,
} from './definition-selector.js';
import {
  detectConflict,
  compareDefinitions,
  formatDiff,
} from './conflict-resolver.js';

/**
 * Action choice for a definition
 */
export type DefinitionAction =
  | 'import'
  | 'skip'
  | 'compare'
  | 'overwrite'
  | 'apply-all'
  | 'skip-all'
  | 'quit';

/**
 * Review context
 */
export interface ReviewContext {
  definition: DefinitionEntry;
  sourceData: MetaobjectTomlDefinition | MetafieldTomlDefinition;
  existingData: MetaobjectTomlDefinition | MetafieldTomlDefinition | null;
  index: number;
  total: number;
}

/**
 * Review result
 */
export interface ReviewResult {
  action: DefinitionAction;
  applyToAll?: boolean;
}

/**
 * Format definition summary for display
 */
function formatDefinitionSummary(context: ReviewContext): string {
  const { definition, existingData, index, total } = context;
  const conflict = detectConflict(context.sourceData, existingData);

  const lines: string[] = [];
  lines.push('━'.repeat(60));
  lines.push(`Import Review (${index + 1}/${total})`);
  lines.push('━'.repeat(60));
  lines.push('');
  lines.push(getDisplayName(definition));
  lines.push('');

  // Details
  getDefinitionDetails(definition).forEach((detail) => {
    lines.push(`  ${detail}`);
  });

  // Status
  lines.push('');
  if (!existingData) {
    lines.push('Status: ✓ Not currently in store');
  } else if (conflict.checksumMatch) {
    lines.push('Status: ✓ Already exists (identical)');
  } else if (conflict.hasConflict) {
    lines.push('Status: ⚠️  CONFLICT - Definition exists with different content');
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Get available actions based on context
 */
function getAvailableActions(
  hasConflict: boolean,
  checksumMatch: boolean
): Array<{ name: string; value: DefinitionAction }> {
  if (checksumMatch) {
    // Definition is identical
    return [
      { name: '[S]kip - Already up to date', value: 'skip' },
      { name: '[C]ompare - View details', value: 'compare' },
      { name: '[K]ip all - Skip all remaining', value: 'skip-all' },
      { name: '[Q]uit - Abort import', value: 'quit' },
    ];
  } else if (hasConflict) {
    // Definition exists but is different
    return [
      { name: '[O]verwrite - Replace with source version', value: 'overwrite' },
      { name: '[S]kip - Keep existing version', value: 'skip' },
      { name: '[C]ompare - View detailed diff', value: 'compare' },
      { name: '[A]pply all - Overwrite this and all remaining conflicts', value: 'apply-all' },
      { name: '[K]ip all - Skip this and all remaining conflicts', value: 'skip-all' },
      { name: '[Q]uit - Abort import', value: 'quit' },
    ];
  } else {
    // New definition
    return [
      { name: '[I]mport - Add to store', value: 'import' },
      { name: '[S]kip - Don\'t import', value: 'skip' },
      { name: '[C]ompare - View details', value: 'compare' },
      { name: '[A]pply all - Import this and all remaining', value: 'apply-all' },
      { name: '[K]ip all - Skip this and all remaining', value: 'skip-all' },
      { name: '[Q]uit - Abort import', value: 'quit' },
    ];
  }
}

/**
 * Show comparison between source and existing
 */
function showComparison(context: ReviewContext): void {
  const { sourceData, existingData } = context;

  if (!existingData) {
    console.log('\nNo existing definition to compare with.');
    return;
  }

  console.log('\n' + '━'.repeat(60));
  console.log('Detailed Comparison');
  console.log('━'.repeat(60));
  console.log('');

  const diff = compareDefinitions(sourceData, existingData);
  console.log(formatDiff(diff));
  console.log('');
}

/**
 * Review a single definition
 */
export async function reviewDefinition(
  context: ReviewContext
): Promise<ReviewResult> {
  // Show summary
  console.log(formatDefinitionSummary(context));

  // Detect conflict
  const conflict = detectConflict(context.sourceData, context.existingData);

  // Get available actions
  const actions = getAvailableActions(
    conflict.hasConflict,
    conflict.checksumMatch
  );

  // Prompt for action
  const answer = await inquirer.prompt<{ action: DefinitionAction }>([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: actions,
    },
  ]);

  // Handle compare action
  if (answer.action === 'compare') {
    showComparison(context);
    console.log('Press Enter to continue...');
    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message: '',
      },
    ]);
    // Recurse to show the prompt again
    return reviewDefinition(context);
  }

  // Handle apply-all and skip-all
  if (answer.action === 'apply-all' || answer.action === 'skip-all') {
    return {
      action: answer.action === 'apply-all' ? (conflict.hasConflict ? 'overwrite' : 'import') : 'skip',
      applyToAll: true,
    };
  }

  return {
    action: answer.action,
    applyToAll: false,
  };
}

/**
 * Review all definitions interactively
 */
export async function reviewAllDefinitions(
  contexts: ReviewContext[]
): Promise<Map<string, DefinitionAction>> {
  const decisions = new Map<string, DefinitionAction>();
  let applyToAll: DefinitionAction | null = null;

  for (let i = 0; i < contexts.length; i++) {
    const context = contexts[i];
    const definitionId = isMetaobjectEntry(context.definition)
      ? context.definition.type
      : `${context.definition.resource}.${context.definition.namespace}.${context.definition.key}`;

    // If we have an apply-to-all decision, use it
    if (applyToAll) {
      decisions.set(definitionId, applyToAll);
      console.log(
        `${getDisplayName(context.definition)}: ${applyToAll === 'import' ? '✓ Importing' : '⊘ Skipping'} (apply-all)`
      );
      continue;
    }

    // Review the definition
    const result = await reviewDefinition(context);

    if (result.action === 'quit') {
      throw new Error('Import aborted by user');
    }

    if (result.applyToAll) {
      applyToAll = result.action;
    }

    decisions.set(definitionId, result.action);
  }

  return decisions;
}

/**
 * Create a summary of import decisions
 */
export function createDecisionSummary(
  decisions: Map<string, DefinitionAction>
): {
  import: number;
  overwrite: number;
  skip: number;
} {
  let importCount = 0;
  let overwriteCount = 0;
  let skipCount = 0;

  decisions.forEach((action) => {
    if (action === 'import') {
      importCount++;
    } else if (action === 'overwrite') {
      overwriteCount++;
    } else if (action === 'skip') {
      skipCount++;
    }
  });

  return {
    import: importCount,
    overwrite: overwriteCount,
    skip: skipCount,
  };
}
