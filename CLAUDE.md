# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **Shopify Metabridge**, a Node.js CLI tool for bridging and syncing Shopify metaobject definitions, metafield definitions, and entries between stores using the Shopify GraphQL Admin API. The tool enables exporting definitions from a source store to TOML files and importing them into target stores, eliminating manual recreation of metaobject structures.

**Key Use Case**: Streamline theme development workflow by maintaining version-controlled definitions that can be quickly deployed to new Shopify stores. The CLI command is `metabridge`, while the package name is `shopify-metabridge`.

## Development Commands

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run a specific test file
npm test -- tests/shopify-client.test.ts

# Run the CLI locally during development
npm run dev -- export --shop mystore --token xxx
npm run dev -- import --input ./metaobjects

# Lint code
npm run lint

# Format code
npm run format

# Check formatting without modifying files
npm run format:check
```

## CLI Usage

```bash
# Initialize metabridge in a project
metabridge init

# Configuration
metabridge config set-repo https://github.com/org/shopify-definitions
metabridge config add-store production --shop mystore.myshopify.com
metabridge config list-stores

# Export metaobject definitions from a store
# Default: saves to .metabridge/exports/<shop-date>/
metabridge export --shop mystore.myshopify.com --token YOUR_TOKEN

# Named export (saves to .metabridge/exports/<name>/)
metabridge export --shop mystore --token YOUR_TOKEN --name production-backup

# Export to specific path
metabridge export --shop mystore --token YOUR_TOKEN --output ./my-export

# Import from configured repository
metabridge import --from repo

# Import from local export
metabridge import --from production-backup

# Import from filesystem path
metabridge import --from ./my-export

# Selective import - specific types
metabridge import --from repo --type blog_author --type faq_item

# Selective import - by category
metabridge import --from repo --category content

# Selective import - by pattern
metabridge import --from repo --pattern "blog_*"

# Import with dependencies
metabridge import --from repo --type advanced_product --with-dependencies

# Non-interactive import
metabridge import --from repo --all --on-conflict skip

# Dry run (preview without making changes)
metabridge import --from repo --dry-run

# Sync repository cache
metabridge sync

# List available sources
metabridge sources list

# Compare two sources
metabridge diff --source1 repo --source2 production-backup

# Copy export between locations
metabridge copy --from production-backup --to ~/exports/backup

# Using environment variables (recommended)
# Set SHOPIFY_SHOP, SHOPIFY_ACCESS_TOKEN, and optionally GITHUB_TOKEN in .env
metabridge export
metabridge import --from repo
```

## High-Level Architecture

### CLI Command Structure
The tool provides multiple commands for managing definitions:
- **init** (`src/commands/init.ts`): Initialize `.metabridge/` structure in a project
- **config** (`src/commands/config.ts`): Manage configuration (repositories, store aliases)
- **export** (`src/commands/export.ts`): Export definitions from Shopify to `.metabridge/exports/` or custom path
- **import** (`src/commands/import.ts`): Import definitions with granular selection and conflict resolution
- **sync** (`src/commands/sync.ts`): Update repository cache from remote
- **sources** (`src/commands/sources.ts`): List available sources (repo, local exports)
- **diff** (`src/commands/diff.ts`): Compare definitions between two sources
- **copy** (`src/commands/copy.ts`): Copy exports between locations

Commands are implemented as separate modules in `src/commands/` and registered in `src/index.ts` using commander.js.

### Data Storage Architecture
The tool uses a `.metabridge/` directory (git-ignored) in each project:
```
project-root/
├── .metabridge/
│   ├── config.toml           # Per-project configuration
│   ├── cache/                # Cached remote repositories
│   │   └── github-org-repo/  # Cloned repository
│   └── exports/              # Local exports from stores
│       ├── mystore-2025-10-27/
│       └── production-backup/
```

### Multi-Source Support
Definitions can be sourced from:
1. **Remote Repository**: GitHub repos configured via `config set-repo`, cached locally
2. **Local Exports**: Named exports in `.metabridge/exports/`
3. **Filesystem Paths**: Any valid path containing a manifest.toml

Source resolution handled by `src/lib/source-resolver.ts`.

### Shopify GraphQL API Integration
- All metaobject operations go through the Shopify Admin API using GraphQL
- Client setup handled in `src/lib/shopify-client.ts` using `graphql-request`
- Key queries/mutations needed:
  - Query: `metaobjectDefinitions` - fetch existing definitions
  - Mutation: `metaobjectDefinitionCreate` - create new definitions
  - Query: `metaobjectDefinition` - fetch a single definition with full details
- API responses include definition schemas with field types, validations, and capabilities
- Handle pagination for stores with many metaobject definitions
- GraphQL queries should be defined in `src/lib/queries.ts` or similar

### Authentication & Configuration
- Store access requires a Shopify Admin API access token with appropriate scopes
- Shop domain needed for API endpoint construction (`https://{shop}.myshopify.com/admin/api/{version}/graphql.json`)
- Configuration is supported via:
  - Environment variables (`.env` file) - see `.env.example` for template
  - CLI flags for one-off operations (`--shop`, `--token`)
  - Environment variables take precedence as defaults; CLI flags override them
- TypeScript types defined in `src/types/index.ts`
- Never commit access tokens or store credentials to version control (`.env` is in `.gitignore`)

### TOML Schema Handling
- Exported TOML files preserve complete metaobject definition structure:
  - Definition type and name
  - Field definitions (type, key, name, validations)
  - Display configuration
  - Access settings (storefront, admin)
- Validate TOML structure before import to catch issues early
- Consider schema versioning if Shopify's metaobject structure evolves

### Key Library Modules
- **config-manager.ts**: Manages `.metabridge/config.toml`, provides accessors for repo/store configuration
- **remote-fetcher.ts**: Clones/pulls GitHub repositories, implements caching with TTL
- **source-resolver.ts**: Resolves `--from` flag to actual filesystem paths
- **definition-selector.ts**: Filters definitions by type, category, pattern; handles dependency resolution
- **interactive-import.ts**: Interactive UI for reviewing/comparing definitions before import
- **conflict-resolver.ts**: Detects conflicts, generates diffs, applies resolution strategies
- **file-operations.ts**: TOML read/write operations for definitions and manifests
- **manifest.ts**: Manages manifest.toml with dependency graphs and import order
- **dependency-resolver.ts**: Builds dependency graphs, validates cycles, calculates import order

### Error Handling
- API rate limits: Shopify uses leaky bucket algorithm - implement retry logic with exponential backoff
- Authentication errors: Provide clear messages about token validity and required scopes
- Duplicate definitions: Handle cases where metaobject type already exists in target store
- Network errors: Implement timeout and retry mechanisms
- Field type mismatches: Validate that imported definitions are compatible with target store's Shopify version

### Testing Considerations
- Mock Shopify API responses for unit tests to avoid hitting real stores
- Integration tests should use a dedicated test store
- Test edge cases: empty definitions, maximum field counts, special characters in type names
- Validate TOML export/import round-trip accuracy

## Shopify-Specific Context

### API Version Management
- Shopify releases new API versions quarterly
- Use a stable API version (e.g., `2024-10`) but allow configuration
- Monitor for deprecation notices in API responses

### Metaobject Field Types
The tool must handle various field types:
- Single-line/multi-line text
- Rich text
- JSON
- Integer, decimal, date, date_time
- Boolean
- URL, color
- File references (single/list)
- Product/variant/collection references (single/list)
- Metaobject references (single/list)

Each type may have specific validation rules that must be preserved during migration.

### Shopify Permissions
Required API access scopes:
- `read_metaobjects` - for export functionality
- `write_metaobjects` - for import functionality

### Rate Limiting
- Shopify Plus stores: 2 requests/second (100 points bucket, 50 points/second restore)
- Standard stores: 2 requests/second (40 points bucket, 20 points/second restore)
- GraphQL queries cost varies by complexity
- Implement exponential backoff starting at 1 second

### Best Practices
- Always validate that target store doesn't have conflicting metaobject type names before import
- Provide dry-run mode to preview changes without applying them
- Log all API operations for debugging and audit purposes
- Consider batch operations for importing multiple definitions efficiently
- Store exports with timestamps to track definition evolution over time
