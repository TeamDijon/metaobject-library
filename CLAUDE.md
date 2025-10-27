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
# Export metaobject definitions from a store
metabridge export --shop mystore.myshopify.com --token YOUR_TOKEN --output ./metaobjects

# Export a specific metaobject type
metabridge export --shop mystore --token YOUR_TOKEN --type typeface

# Import metaobject definitions to a store
metabridge import --shop newstore.myshopify.com --token YOUR_TOKEN --input ./metaobjects

# Dry run (preview without making changes)
metabridge import --shop newstore --token YOUR_TOKEN --dry-run

# Using environment variables (recommended)
# Set SHOPIFY_SHOP and SHOPIFY_ACCESS_TOKEN in .env
metabridge export
metabridge import --dry-run
```

## High-Level Architecture

### CLI Command Structure
The tool is organized around two primary commands:
- **export** (`src/commands/export.ts`): Fetches metaobject definitions from a Shopify store and saves to JSON
- **import** (`src/commands/import.ts`): Reads JSON files and creates metaobject definitions in a target store

Commands are implemented as separate modules in `src/commands/` and registered in `src/index.ts` using commander.js.

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
