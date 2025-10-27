# Architecture Documentation

## Overview

Shopify Metabridge is a CLI tool for managing Shopify metaobject and metafield definitions using TOML files. The tool features a **multi-source architecture** that supports importing definitions from remote Git repositories, local exports, or filesystem paths, with granular selection, interactive conflict resolution, and automatic dependency management.

## Design Principles

1. **Multi-Source Flexibility**: Support remote repositories, local exports, and filesystem paths
2. **Git-Native Format**: Use TOML to match Shopify's native configuration format
3. **Project-Local Storage**: `.metabridge/` directory (git-ignored) per project
4. **Dependency Aware**: Automatic dependency resolution and topological sorting
5. **Interactive UX**: User-friendly prompts for conflicts and selection
6. **Smart Caching**: Repository caching with configurable TTL
7. **Granular Control**: Filter imports by type, category, or pattern

## Multi-Source Architecture

### Data Source Types

The tool supports three types of definition sources:

1. **Remote Repository** (GitHub/GitLab)
   - Configured via `metabridge config set-repo <url>`
   - Cloned and cached in `.metabridge/cache/`
   - Supports authentication via `GITHUB_TOKEN`
   - Automatic cache management with TTL

2. **Local Exports**
   - Stored in `.metabridge/exports/`
   - Named exports: `.metabridge/exports/<name>/`
   - Auto-named: `.metabridge/exports/<shop-date>/`
   - Git-ignored for each project

3. **Filesystem Paths**
   - Any directory containing `manifest.toml`
   - Supports absolute and relative paths
   - Useful for shared network drives or cross-project references

### Project Directory Structure

```
my-shopify-project/
├── .metabridge/                     # Git-ignored (added to .gitignore)
│   ├── config.toml                  # Per-project configuration
│   ├── cache/                       # Cached remote repositories
│   │   └── github-org-repo/         # Cloned repository
│   │       ├── manifest.toml
│   │       ├── metaobjects/
│   │       └── metafields/
│   └── exports/                     # Local exports from stores
│       ├── production-2025-10-27/   # Auto-named export
│       │   ├── manifest.toml
│       │   ├── metaobjects/
│       │   └── metafields/
│       └── staging-backup/          # Named export
│           ├── manifest.toml
│           └── ...
├── .gitignore                       # Contains .metabridge/
├── .env                             # Shopify credentials
└── ...project files...
```

### Configuration File Structure

**`.metabridge/config.toml`**:
```toml
[repository]
url = "https://github.com/myorg/shopify-definitions"
branch = "main"
cache_ttl = 3600                     # Seconds (1 hour default)

[stores]
[stores.production]
shop = "mystore.myshopify.com"
description = "Production store"

[stores.staging]
shop = "staging.myshopify.com"
description = "Staging environment"

[defaults]
import_source = "repo"               # Default source for imports
conflict_resolution = "prompt"        # prompt | skip | overwrite | abort
```

## Definition Repository Structure

Whether from a remote repository, local export, or filesystem path, all sources share this structure:

```
shopify-definitions/                 # Can be remote repo or local export
├── manifest.toml                    # Central manifest with dependencies
├── metaobjects/
│   ├── content/
│   │   ├── hero_banner.toml
│   │   └── testimonial.toml
│   └── products/
│       └── typeface.toml
└── metafields/
    ├── product/
    │   ├── care_instructions.toml
    │   └── key_features.toml
    ├── variant/
    ├── collection/
    └── shop/
        └── brand_settings.toml
```

## Source Resolution Flow

When a user runs `metabridge import --from <source>`, the tool resolves the source through these steps:

```
Input: --from <source>
    ↓
┌───────────────────────────────────┐
│ Is source "repo" or "repository"? │
└───────────────────────────────────┘
    Yes ↓                  No ↓
┌─────────────────┐   ┌──────────────────────────────┐
│ Load config     │   │ Check .metabridge/exports/   │
│ repository.url  │   │ for matching name            │
└─────────────────┘   └──────────────────────────────┘
    ↓                     Found ↓         Not Found ↓
┌─────────────────┐   ┌─────────────┐   ┌───────────────────┐
│ Clone/pull to   │   │ Resolve to  │   │ Check if absolute │
│ .metabridge/    │   │ .metabridge/│   │ or relative path  │
│ cache/<repo>/   │   │ exports/    │   │ exists            │
└─────────────────┘   │ <name>/     │   └───────────────────┘
    ↓                 └─────────────┘       Exists ↓  Not Found ↓
┌─────────────────┐           ↓         ┌──────────┐ ┌──────────┐
│ Check cache age │           ↓         │ Use path │ │ Error:   │
│ vs TTL          │           ↓         └──────────┘ │ Source   │
└─────────────────┘           ↓                      │ not found│
    Stale ↓    Fresh ↓         ↓                      └──────────┘
┌─────────┐ ┌─────────┐       ↓
│ git pull│ │ Use     │       ↓
└─────────┘ │ cached  │       ↓
    ↓       └─────────┘       ↓
    └───────────┴─────────────┘
                ↓
        ┌────────────────┐
        │ Validate       │
        │ manifest.toml  │
        │ exists         │
        └────────────────┘
                ↓
        ┌────────────────┐
        │ Return         │
        │ ResolvedSource │
        └────────────────┘
```

**ResolvedSource Interface**:
```typescript
interface ResolvedSource {
  type: SourceType;        // REPOSITORY | LOCAL_EXPORT | FILESYSTEM_PATH
  path: string;            // Absolute path to source directory
  displayName: string;     // User-friendly name for display
  cacheAge?: number;       // Age in seconds (for repositories)
}
```

## Import Workflow with Granular Selection

### Command Examples

```bash
# Import everything from repository
metabridge import --from repo --all

# Import specific types
metabridge import --from repo --type blog_author --type faq_item

# Import by category
metabridge import --from repo --category content

# Import by glob pattern
metabridge import --from repo --pattern "blog_*"

# Import with dependencies
metabridge import --from repo --type product_card --with-dependencies

# Import excluding certain types
metabridge import --from repo --all --exclude-type test_object
```

### Selection & Filtering Flow

```
1. Load manifest from resolved source
    ↓
2. Get all definitions (metaobjects + metafields)
    ↓
3. Apply filters:
    ├─ --type: Include matching types
    ├─ --category: Include matching categories
    ├─ --pattern: Include glob pattern matches
    ├─ --exclude-type: Exclude specific types
    └─ --exclude-category: Exclude categories
    ↓
4. Handle dependencies:
    ├─ --with-dependencies: Add all dependencies to selection
    ├─ --dependencies-only: Select only dependencies, exclude original
    └─ (default): Include dependencies automatically
    ↓
5. Sort by dependency order (topological sort)
    ↓
6. Interactive review OR automatic import
```

### Interactive Import Flow

When no `--all` or `--no-interactive` flag:

```
For each definition in sorted order:
    ↓
┌──────────────────────────────┐
│ Display definition summary:  │
│  - Name and type             │
│  - Category                  │
│  - Fields count              │
│  - Dependencies              │
└──────────────────────────────┘
    ↓
┌──────────────────────────────┐
│ Check if exists in store     │
└──────────────────────────────┘
    Not exists ↓         Exists ↓
┌─────────────────┐   ┌─────────────────────────┐
│ Prompt:         │   │ Detect conflict:        │
│ [I]mport        │   │  - Compare checksums    │
│ [S]kip          │   │  - Generate diff        │
│ [C]ompare       │   └─────────────────────────┘
│ [A]pply all     │                ↓
│ [K]ip all       │   ┌─────────────────────────┐
│ [Q]uit          │   │ Prompt:                 │
└─────────────────┘   │ [O]verwrite             │
                      │ [S]kip                  │
                      │ [C]ompare (show diff)   │
                      │ [A]pply all conflicts   │
                      │ [K]ip all conflicts     │
                      │ [Q]uit                  │
                      └─────────────────────────┘
```

**Compare View** shows:
- Fields added in source
- Fields removed in source
- Fields with different types
- Fields with different validations

### Non-Interactive Mode

```bash
metabridge import --from repo --all --no-interactive --on-conflict skip
```

Flow:
1. Load and filter definitions
2. For each definition:
   - If not exists → Import
   - If exists with same checksum → Skip (identical)
   - If exists with different content → Apply `--on-conflict` strategy:
     - `skip`: Don't import, keep existing
     - `overwrite`: Replace existing with source
     - `abort`: Stop entire import process

## Dependency Resolution

### Dependency Types

```toml
[dependencies]
metaobjects = ["typeface", "product_specs"]           # Custom metaobjects
metafields = ["custom.size_chart"]                    # Custom metafields
standard_metafields = ["reviews.rating", "facts.isbn"] # Shopify standard
standard_metaobjects = ["product_review"]             # Shopify standard
```

### Resolution Algorithm

```
1. Build dependency graph from all definitions
    ↓
2. Classify dependencies:
    ├─ Custom metaobjects (must be in import set)
    ├─ Custom metafields (must be in import set)
    ├─ Standard metafields (must be enabled in store)
    └─ Standard metaobjects (must be enabled in store)
    ↓
3. Validate all dependencies exist:
    ├─ Custom: In import set OR already in target store
    └─ Standard: Enabled in target store
    ↓
4. Topological sort (DFS-based):
    ├─ Visit each definition
    ├─ Recursively visit dependencies first
    └─ Detect cycles → Error and abort
    ↓
5. Return ordered list for import
```

**Example Dependency Chain**:
```
typeface (no deps)
    ↓ referenced by
key_features (depends on typeface)
    ↓ referenced by
product_card (depends on key_features)

Import order: [typeface, key_features, product_card]
```

## Repository Caching Strategy

### Cache Management

```
Repository URL: https://github.com/org/shopify-definitions
    ↓
Sanitize URL → "github-org-shopify-definitions"
    ↓
Cache path: .metabridge/cache/github-org-shopify-definitions/
    ↓
┌────────────────────┐
│ Check if cached    │
└────────────────────┘
    Not cached ↓       Cached ↓
┌──────────────┐   ┌─────────────────┐
│ git clone    │   │ Check cache age │
│ --depth 1    │   │ vs cache_ttl    │
│ --branch X   │   └─────────────────┘
└──────────────┘      Stale ↓   Fresh ↓
    ↓            ┌──────────┐ ┌────────┐
    └────────────│ git pull │ │ Use    │
                 └──────────┘ │ cache  │
                      ↓       └────────┘
                      └─────────┘
                            ↓
                    ┌──────────────┐
                    │ Return path  │
                    └──────────────┘
```

### Authentication

Supports GitHub authentication for private repositories:
- Environment variable: `GITHUB_TOKEN`
- Injected into clone URL: `https://{token}@github.com/...`
- Falls back to SSH if git is configured with SSH keys

### Cache Invalidation

- `metabridge sync`: Update cache from remote
- `metabridge sync --force`: Force refresh even if fresh
- `metabridge config clear-cache`: Delete all cached repos
- TTL expiration: Automatic refresh on next use

## File Schemas

### Metaobject Definition

```toml
# Metaobject: Typeface
# Category: products
# Version: 1.0.0
# Last Modified: 2025-10-27T10:30:00Z

[definition]
type = "typeface"
name = "Typeface"
description = "Font family definitions"
display_name_field = "font_family"
category = "products"

[definition.access]
admin = "MERCHANT_READ_WRITE"
storefront = "PUBLIC_READ"

[definition.capabilities]
translatable = false
publishable = false

[fields.font_family]
name = "Font Family"
type = "single_line_text_field"
required = true

[fields.font_weight]
name = "Font Weight"
type = "number_integer"
required = false

[[fields.font_weight.validations]]
name = "min"
value = "100"

[[fields.font_weight.validations]]
name = "max"
value = "900"

[dependencies]
metaobjects = []
metafields = []
standard_metafields = []
standard_metaobjects = []
```

### Metafield Definition

```toml
# Metafield: Product Key Features
# Resource: product
# Category: products
# Version: 1.0.0

[definition]
namespace = "custom"
key = "key_features"
name = "Key Features"
description = "Product key features"
type = "list.metaobject_reference"
resource = "product"
category = "products"

[definition.access]
storefront = "PUBLIC_READ"

[dependencies]
metaobjects = ["typeface"]
metafields = []
standard_metafields = []
standard_metaobjects = []
```

### Manifest File

```toml
[manifest]
version = "1.0.0"
schema_version = "1"
last_updated = "2025-10-27T10:30:00Z"
tool_version = "0.1.0"

[[metaobjects]]
type = "typeface"
category = "products"
path = "metaobjects/products/typeface.toml"
version = "1.0.0"
last_modified = "2025-10-27T10:30:00Z"
checksum = "sha256:abc123..."
dependencies = []

[[metafields]]
resource = "product"
namespace = "custom"
key = "key_features"
category = "products"
path = "metafields/product/key_features.toml"
checksum = "sha256:def456..."
dependencies = ["typeface"]

[dependency_graph]
typeface = []
"product.custom.key_features" = ["typeface"]

[import_order]
metaobjects = ["typeface"]
metafields = ["product.custom.key_features"]
```

## CLI Command Structure

### Commands Overview

| Command | Module | Description |
|---------|--------|-------------|
| `init` | `src/commands/init.ts` | Initialize `.metabridge/` structure |
| `config` | `src/commands/config.ts` | Manage configuration |
| `export` | `src/commands/export.ts` | Export from Shopify to local |
| `import` | `src/commands/import.ts` | Import with granular selection |
| `sync` | `src/commands/sync.ts` | Update repository cache |
| `sources` | `src/commands/sources.ts` | List available sources |
| `diff` | `src/commands/diff.ts` | Compare two sources |
| `copy` | `src/commands/copy.ts` | Copy exports between locations |

### Key Library Modules

| Module | Purpose |
|--------|---------|
| `config-manager.ts` | Manage `.metabridge/config.toml` |
| `remote-fetcher.ts` | Git clone/pull with caching |
| `source-resolver.ts` | Resolve `--from` to filesystem paths |
| `definition-selector.ts` | Filter and select definitions |
| `interactive-import.ts` | Interactive review UI |
| `conflict-resolver.ts` | Detect conflicts and generate diffs |
| `file-operations.ts` | TOML read/write operations |
| `manifest.ts` | Manifest management |
| `dependency-resolver.ts` | Build graphs and resolve order |

## Export Workflow

### Process Flow

```
1. Validate Shopify configuration
    ↓
2. Create Shopify GraphQL client
    ↓
3. Determine output directory:
    ├─ --output: Use explicit path
    ├─ --name: Use .metabridge/exports/<name>/
    └─ (default): Use .metabridge/exports/<shop-date>/
    ↓
4. Query metaobject definitions from Shopify
    ↓
5. Query metafield definitions from Shopify (all resource types)
    ↓
6. Convert API responses to TOML format
    ↓
7. Organize files by category (metaobjects) and resource (metafields)
    ↓
8. Calculate SHA-256 checksums
    ↓
9. Build dependency graph
    ↓
10. Update manifest.toml
    ↓
11. Display summary
```

### GraphQL Queries

**Metaobject Definitions:**
```graphql
query {
  metaobjectDefinitions(first: 250) {
    edges {
      node {
        id
        type
        name
        description
        displayNameKey
        access { admin storefront }
        capabilities { publishable translatable }
        fieldDefinitions {
          key
          name
          type
          required
          validations { name value }
        }
      }
    }
  }
}
```

**Metafield Definitions:**
```graphql
query {
  metafieldDefinitions(ownerType: PRODUCT, first: 250) {
    edges {
      node {
        namespace
        key
        name
        description
        type
        access { admin storefront }
        validations { name value }
      }
    }
  }
}
```

## Technical Implementation

### TOML Parsing

- **Library**: `@iarna/toml`
- **Parse**: `TOML.parse(fileContent)`
- **Stringify**: `TOML.stringify(object)`
- **Overhead**: ~5-10% vs JSON, acceptable for Shopify alignment

### Checksum Generation

```typescript
import crypto from 'crypto';

function calculateChecksum(content: string): string {
  return 'sha256:' + crypto
    .createHash('sha256')
    .update(content)
    .digest('hex');
}
```

### Dependency Graph

**Structure**: Adjacency list
```typescript
interface DependencyGraph {
  [definitionId: string]: string[];
}
```

**Algorithm**: Topological sort using DFS
- Detects cycles
- Returns ordered list for import
- Ensures dependencies are imported before dependents

### GraphQL Client

- **Library**: `graphql-request`
- **Rate Limiting**: Exponential backoff (1s, 2s, 4s, 8s, 16s)
- **API Version**: Configurable (default: latest stable)

## Error Handling

### Error Categories

1. **Configuration Errors**: Missing repository, invalid config
2. **Authentication Errors**: Invalid shop domain or access token
3. **Network Errors**: API timeouts, connection failures
4. **Rate Limit Errors**: Shopify API rate limit exceeded
5. **Validation Errors**: Invalid TOML syntax, missing fields
6. **Dependency Errors**: Missing dependencies, circular dependencies
7. **Conflict Errors**: Definition already exists in target store

### Handling Strategy

- **Graceful Degradation**: Continue processing other definitions
- **Clear Messages**: Actionable error information
- **Retry Logic**: Automatic retry for transient errors
- **User Prompts**: Interactive resolution for conflicts

## Security Considerations

1. **Access Tokens**: Never commit to version control
   - Use `.env` files (gitignored)
   - Use environment variables
2. **Git Credentials**: Support `GITHUB_TOKEN` for private repos
3. **API Scopes**: Require minimal scopes
4. **Input Validation**: Sanitize all user inputs

## Future Enhancements

1. **Standard Definition Enablement**: Auto-enable Shopify standard definitions
2. **Dependency Visualization**: `metabridge deps --graph`
3. **Local Validation**: `metabridge validate`
4. **Watch Mode**: Auto-export on remote changes
5. **Performance**: Parallel GraphQL queries
6. **Testing**: Comprehensive test coverage

## References

- [Shopify Custom Data Documentation](https://shopify.dev/docs/apps/build/custom-data)
- [Metaobject Definitions](https://shopify.dev/docs/apps/build/custom-data/metaobjects)
- [Metafield Definitions](https://shopify.dev/docs/apps/build/custom-data/metafields/definitions)
- [TOML Specification](https://toml.io/)
- [Shopify GraphQL Admin API](https://shopify.dev/docs/api/admin-graphql)
