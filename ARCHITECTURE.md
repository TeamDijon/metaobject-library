# Architecture Documentation

## Overview

This CLI tool manages Shopify metaobject and metafield definitions using TOML files stored in a dedicated external repository. The tool enables exporting definitions from a source store and importing them into target stores, with sophisticated dependency resolution and support for Shopify's standard definitions.

## Design Principles

1. **Shopify-Native Format**: Use TOML to match Shopify's native configuration format
2. **Version Control First**: Structure optimized for git diff and change tracking
3. **Dependency Aware**: Automatic dependency resolution and topological sorting
4. **Standard Definition Support**: Recognize and handle Shopify's standard metafield/metaobject definitions
5. **User Control**: Interactive prompts for conflicts and missing dependencies
6. **Minimal Overhead**: TOML parsing adds <10% code overhead vs JSON

## External Repository Structure

The tool exports to (and imports from) a dedicated repository with the following structure:

```
shopify-definitions/                 # External private repository
├── manifest.toml                    # Global manifest with versions and dependencies
├── metaobjects/
│   ├── content/
│   │   ├── hero_banner.toml        # One file per metaobject definition
│   │   └── testimonial.toml
│   └── products/
│       └── typeface.toml
├── metafields/
│   ├── product/                     # Organized by resource type
│   │   ├── care_instructions.toml
│   │   └── key_features.toml
│   ├── variant/
│   ├── collection/
│   ├── customer/
│   └── shop/                        # Store-wide metafields
│       └── brand_settings.toml
└── .definitions/                    # Tool metadata (gitignored)
    ├── exports/
    │   └── export-2025-10-21.toml  # Export metadata with timestamps
    └── standards/                   # Track enabled standard definitions
        ├── metafields.toml
        └── metaobjects.toml
```

### Directory Organization

- **`metaobjects/`**: Custom metaobject definitions organized by category (user-defined)
- **`metafields/`**: Metafield definitions organized by Shopify resource type (product, variant, collection, shop, etc.)
- **`manifest.toml`**: Central manifest tracking all definitions, versions, checksums, and dependencies
- **`.definitions/`**: Tool-specific metadata (export history, enabled standard definitions)

## File Schemas

### Metaobject Definition File

Each metaobject is stored as a separate TOML file:

```toml
# Metaobject: Typeface
# Category: products
# Version: 1.0.0
# Last Modified: 2025-10-21T10:30:00Z

[definition]
type = "typeface"                    # Shopify metaobject type identifier
name = "Typeface"                    # Display name
description = "Font family definitions for the theme"
display_name_field = "font_family"   # Which field to use as display name
category = "products"                # Organization category (tool metadata)

[definition.access]
admin = "merchant_read_write"        # Admin access level
storefront = "public_read"           # Storefront access level

[definition.capabilities]
translatable = false                 # Translation support
publishable = false                  # Publish/unpublish capability

# Field definitions
[fields.font_family]
name = "Font Family"
type = "single_line_text_field"
required = true
description = "The font family name"

[fields.font_weight]
name = "Font Weight"
type = "number_integer"
required = false

[[fields.font_weight.validations]]   # Array of validation rules
name = "min"
value = "100"

[[fields.font_weight.validations]]
name = "max"
value = "900"

[fields.font_url]
name = "Font URL"
type = "url"
required = false

# Dependencies declaration
[dependencies]
metaobjects = []                     # Custom metaobjects this depends on
metafields = []                      # Custom metafields this depends on
standard_metafields = []             # Shopify standard metafields (e.g., ["descriptors.subtitle"])
standard_metaobjects = []            # Shopify standard metaobjects (e.g., ["product_review"])
```

### Metafield Definition File

Each metafield is stored as a separate TOML file organized by resource type:

```toml
# Metafield: Product Key Features
# Resource: product
# Category: products
# Version: 1.0.0
# Last Modified: 2025-10-21T10:30:00Z

[definition]
namespace = "custom"                 # Metafield namespace (user-controlled)
key = "key_features"                 # Metafield key (user-controlled)
name = "Key Features"                # Display name
description = "Product key features"
type = "list.metaobject_reference<$app:typeface>"  # Field type with reference
resource = "product"                 # Shopify resource type
category = "products"                # Organization category (tool metadata)

[definition.access]
storefront = "public_read"           # Storefront access

[definition.validations]
# Validation rules if applicable

# Dependencies declaration
[dependencies]
metaobjects = ["typeface"]           # Depends on typeface metaobject
metafields = []
standard_metafields = ["reviews.rating"]  # Example: depends on standard rating field
standard_metaobjects = []
```

### Global Manifest File

The manifest provides a centralized view of all definitions and their relationships:

```toml
# Shopify Definitions Manifest
# Central tracking for all definitions, versions, and dependencies

[manifest]
version = "1.0.0"                    # Manifest version (semantic versioning)
schema_version = "1"                 # Schema version for compatibility
last_updated = "2025-10-21T10:30:00Z"
tool_version = "0.1.0"               # Version of metaobject-library tool

# Metaobject definitions registry
[[metaobjects]]
type = "typeface"
category = "products"
path = "metaobjects/products/typeface.toml"
version = "1.0.0"
last_modified = "2025-10-21T10:30:00Z"
checksum = "sha256:abc123..."       # SHA-256 for change detection
dependencies = []                    # Combined list of all dependencies

[[metaobjects]]
type = "hero_banner"
category = "content"
path = "metaobjects/content/hero_banner.toml"
version = "1.0.0"
last_modified = "2025-10-21T10:30:00Z"
checksum = "sha256:def456..."
dependencies = []

# Metafield definitions registry
[[metafields]]
resource = "product"
namespace = "custom"
key = "key_features"
category = "products"
path = "metafields/product/key_features.toml"
version = "1.0.0"
last_modified = "2025-10-21T10:30:00Z"
checksum = "sha256:ghi789..."
dependencies = ["typeface", "reviews.rating"]  # Custom and standard dependencies

# Dependency graph (auto-generated from definitions)
[dependency_graph]
typeface = []                        # No dependencies
hero_banner = []
key_features = ["typeface", "reviews.rating"]  # Depends on these

# Import order (topologically sorted based on dependencies)
# Ensures dependencies are imported before dependent definitions
[import_order]
metaobjects = ["typeface", "hero_banner"]
metafields = ["key_features"]
```

### Export Metadata File

Historical metadata for each export operation:

```toml
# Export Metadata
# Timestamp: 2025-10-21T10:30:00Z

[export]
timestamp = "2025-10-21T10:30:00Z"
source_store = "mystore.myshopify.com"
api_version = "2025-01"
tool_version = "0.1.0"

[export.counts]
metaobjects = 12
metafields = 8
total = 20

# Summary of exported definitions
[[export.definitions]]
type = "metaobject"
name = "typeface"
category = "products"
fields_count = 8
checksum = "sha256:abc123..."

[[export.definitions]]
type = "metafield"
resource = "product"
namespace = "custom"
key = "key_features"
checksum = "sha256:def456..."
```

### Standard Definitions Tracking

Track which Shopify standard definitions are enabled:

```toml
# .definitions/standards/metafields.toml
# Tracks enabled Shopify standard metafield definitions

[[enabled]]
template_id = "1"                    # Shopify template ID
namespace = "descriptors"
key = "subtitle"
resource = "product"
name = "Product Subtitle"
enabled_at = "2025-10-21T10:30:00Z"

[[enabled]]
template_id = "6"
namespace = "reviews"
key = "rating"
resource = "product"
name = "Product Rating"
enabled_at = "2025-10-21T10:30:00Z"
```

```toml
# .definitions/standards/metaobjects.toml
# Tracks enabled Shopify standard metaobject definitions

[[enabled]]
template_id = "product_review"
type = "product_review"
name = "Product Review"
enabled_at = "2025-10-21T10:30:00Z"
```

## Dependency Resolution Strategy

### Dependency Types

The system recognizes four types of dependencies:

1. **Custom Metaobjects**: User-created metaobject definitions
2. **Custom Metafields**: User-created metafield definitions
3. **Standard Metafields**: Shopify pre-configured metafields (e.g., `descriptors.subtitle`, `reviews.rating`)
4. **Standard Metaobjects**: Shopify pre-configured metaobjects (e.g., `product_review`)

### Standard Definition Recognition

Standard definitions are identified by their namespace patterns:

**Standard Metafield Namespaces:**
- `descriptors.*` (e.g., subtitle, care_guide)
- `facts.*` (e.g., isbn, upc, ean)
- `reviews.*` (e.g., rating, rating_count)
- `shopify--discovery--product_recommendation.*`
- `shopify--discovery--product_search_boost.*`
- `import_information.*`

**Standard Metaobjects:**
- `product_review`
- Future standard types as Shopify adds them

### Dependency Declaration

Each definition file explicitly declares its dependencies:

```toml
[dependencies]
metaobjects = ["typeface", "product_specs"]           # Custom metaobjects
metafields = ["custom.size_chart"]                    # Custom metafields
standard_metafields = ["reviews.rating", "facts.isbn"] # Standard metafields
standard_metaobjects = ["product_review"]             # Standard metaobjects
```

### Import Order Resolution

The import process follows these steps:

1. **Parse All Definitions**: Read all TOML files from the repository
2. **Build Dependency Graph**: Create directed graph of dependencies
3. **Classify Dependencies**: Separate custom vs standard definitions
4. **Validate Standard Dependencies**: Check if standard definitions are enabled in target store
5. **Topological Sort**: Order definitions so dependencies are imported first
6. **Import Execution**: Process definitions in sorted order

**Example Dependency Chain:**

```
metaobjects/products/typeface.toml (no dependencies)
    ↓ (referenced by)
metafields/product/key_features.toml (depends on typeface)
    ↓ (referenced by)
metaobjects/products/product_card.toml (depends on key_features)
```

**Import Order:** typeface → key_features → product_card

### Missing Dependency Handling

When a dependency is missing during import, the user is prompted:

```
⚠️  Missing dependency detected

Definition: key_features (product metafield)
Missing: typeface (custom metaobject)
Reason: Not found in import set or target store

Options:
[S] Skip this definition (will not be imported)
[P] Proceed anyway (import will likely fail)
[A] Skip all definitions with missing dependencies
[C] Continue all (proceed with all missing dependencies)
[X] Abort entire import process

Choice:
```

### Standard Definition Handling

When a standard definition dependency is detected:

**If enabled in target store:**
- Log info message: `✓ Standard definition 'reviews.rating' found in target store`
- Continue import

**If not enabled in target store:**
```
⚠️  Standard definition not enabled

Definition: key_features (product metafield)
Requires: reviews.rating (standard metafield)
Status: Not enabled in target store

Options:
[E] Enable standard definition in target store
[S] Skip this definition
[X] Abort import

Choice:
```

If user chooses to enable, the CLI uses:
```graphql
mutation {
  standardMetafieldDefinitionEnable(
    templateId: "gid://shopify/StandardMetafieldDefinitionTemplate/6"
  ) {
    metafieldDefinition { id }
  }
}
```

### Failed Import Tracking

The system tracks all import operations and reports at the end:

```
═══════════════════════════════════════════════
Import Summary
═══════════════════════════════════════════════

✓ Successfully Imported: 8 definitions
  - typeface (metaobject)
  - hero_banner (metaobject)
  - care_instructions (product metafield)
  - brand_settings (shop metafield)
  ...

⚠️  Failed Imports: 2 definitions
  - key_features (product metafield)
    Reason: Missing metaobject 'typeface'
  - product_card (metaobject)
    Reason: GraphQL error - Invalid field type

⏭  Skipped by User: 1 definition
  - testimonial (metaobject)
    Reason: User chose to skip

Standard Definitions Enabled: 1
  - reviews.rating (product metafield)

═══════════════════════════════════════════════
```

## Namespace Strategy

### Metafield Namespaces

- **User-Controlled**: Namespaces and keys are defined by the user
- **Export Preserves**: Export captures exact namespace/key from source store
- **Import Uses Exact Values**: Import uses namespace/key from TOML file as-is
- **No Auto-Generation**: Tool does not modify or generate namespaces
- **App Metafields**: App-scoped metafields (`$app:*`) are exported with their actual namespace

### Common Namespace Patterns

- `custom`: General custom metafields
- `app`: App-specific metafields (scoped to the app)
- `$app`: Shopify's reserved app namespace format
- Standard namespaces: `descriptors`, `facts`, `reviews`, etc.

## Export Workflow

### Command Usage

```bash
# Export all definitions
metaobject export --shop mystore.myshopify.com --token TOKEN --output ./shopify-definitions

# Export specific metaobject type
metaobject export --shop mystore --token TOKEN --type typeface

# Export to current directory
metaobject export
```

### Export Process

1. **Authentication**: Validate shop and access token
2. **Query Metaobjects**: Fetch all metaobject definitions via GraphQL
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
           fieldDefinitions { key name type required validations }
         }
       }
     }
   }
   ```
3. **Query Metafields**: Fetch all metafield definitions for each resource type
   ```graphql
   query {
     metafieldDefinitions(ownerType: PRODUCT, first: 250) {
       edges {
         node {
           id
           namespace
           key
           name
           description
           type
           validations { name value }
           access { admin storefront }
         }
       }
     }
   }
   ```
4. **Detect Standard Definitions**: Identify standard vs custom definitions
5. **Analyze Dependencies**: Parse field types for references (e.g., `metaobject_reference<$app:typeface>`)
6. **Generate TOML Files**: Convert API responses to TOML format
7. **Organize Files**: Place in appropriate category folders
8. **Calculate Checksums**: SHA-256 hash of file content
9. **Update Manifest**: Add/update entries in `manifest.toml`
10. **Track Standards**: Update `.definitions/standards/` files
11. **Create Export Metadata**: Save timestamped export record

### Auto-Manifest Update

On every export, the manifest is automatically updated:

- New definitions: Added to manifest
- Changed definitions: Update checksum, version, last_modified
- Removed definitions: Remove from manifest
- Dependencies: Re-analyze and update dependency graph
- Import order: Recalculate topological sort
- Manifest version: Increment according to semantic versioning

## Import Workflow

### Command Usage

```bash
# Import all definitions from repository
metaobject import --shop newstore.myshopify.com --token TOKEN --input ./shopify-definitions

# Dry run (preview without changes)
metaobject import --shop newstore --token TOKEN --dry-run

# Import from current directory
metaobject import --dry-run
```

### Import Process

1. **Read Manifest**: Parse `manifest.toml` to discover all definitions
2. **Load Definitions**: Read and parse all TOML files
3. **Validate Checksums**: Ensure file integrity matches manifest
4. **Build Dependency Graph**: Analyze all dependencies
5. **Classify Dependencies**: Separate custom and standard definitions
6. **Check Target Store**:
   - Query existing metaobject definitions
   - Query existing metafield definitions
   - Check enabled standard definitions
7. **Validate Dependencies**:
   - Custom dependencies: Must exist in import set or target store
   - Standard dependencies: Must be enabled in target store
8. **Handle Missing Dependencies**: Interactive prompts for each missing dependency
9. **Topological Sort**: Order definitions for import
10. **Dry Run Check**: If `--dry-run`, display plan and exit
11. **Execute Imports**:
    - For each definition in sorted order:
      - Check if exists in target store
      - If exists: Prompt user (Skip/Overwrite/Compare)
      - If new: Create via GraphQL mutation
      - Track success/failure in memory
12. **Enable Standard Definitions**: Prompt and enable if needed
13. **Generate Summary**: Report successes, failures, and skips

### Conflict Resolution

When a definition already exists in the target store:

```
⚠️  Conflict detected

Definition: typeface (metaobject)
Status: Already exists in target store
Local version: 1.2.0
Remote version: 1.0.0

Options:
[S] Skip (keep existing definition)
[O] Overwrite (replace with local definition)
[C] Compare (show differences)
[A] Skip all conflicts
[X] Abort import

Choice:
```

If user chooses "Compare":
```
Comparing: typeface (metaobject)

Fields in local but not remote:
  + font_url (url)

Fields in remote but not local:
  - font_style (single_line_text_field)

Fields with different types:
  font_weight: number_integer (local) vs single_line_text_field (remote)

[S] Skip / [O] Overwrite / [B] Back to menu
```

### Dry Run Mode

When `--dry-run` is specified, the tool shows what would happen without making changes:

```
═══════════════════════════════════════════════
Dry Run Mode - No changes will be made
═══════════════════════════════════════════════

Definitions to Import: 10

Import Order:
  1. typeface (metaobject) - NEW
  2. hero_banner (metaobject) - NEW
  3. care_instructions (product metafield) - NEW
  4. key_features (product metafield) - CONFLICT (exists)
  ...

Standard Definitions Required:
  - reviews.rating (product metafield) - NOT ENABLED

Warnings:
  ⚠️  Definition 'key_features' already exists (would prompt for action)
  ⚠️  Standard definition 'reviews.rating' not enabled (would prompt to enable)

═══════════════════════════════════════════════
```

## Technical Implementation Details

### TOML Parsing

**Library**: `@iarna/toml`

**Rationale**:
- Mature, well-maintained library
- Full TOML spec support
- Good TypeScript types
- Minimal dependencies

**Usage**:
```typescript
import TOML from '@iarna/toml';

// Parse TOML file
const definition = TOML.parse(fileContent);

// Generate TOML string
const tomlString = TOML.stringify(definition);
```

**Overhead**: ~5-10% additional code vs JSON, acceptable for Shopify alignment

### Checksum Generation

**Algorithm**: SHA-256

**Purpose**:
- Detect changes to definition files
- Validate file integrity
- Enable efficient change detection

**Implementation**:
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

**Structure**: Adjacency list representation

**Algorithm**: Topological sort using depth-first search (DFS)

**Implementation**:
```typescript
interface DependencyGraph {
  [definitionId: string]: string[];  // definitionId -> [dependencies]
}

function topologicalSort(graph: DependencyGraph): string[] {
  // DFS-based topological sort
  // Returns ordered list for import
}
```

**Cycle Detection**: If circular dependency detected, report error and abort

### GraphQL API Integration

**Client**: `graphql-request` library

**API Version**: Configurable (default: latest stable)

**Rate Limiting**: Implement exponential backoff
- Initial delay: 1 second
- Max retries: 5
- Backoff multiplier: 2x

**Key Queries**:
- `metaobjectDefinitions`: List all metaobject definitions
- `metafieldDefinitions`: List metafield definitions by resource type
- `standardMetafieldDefinitionTemplates`: List available standard metafield templates
- `standardMetaobjectDefinitionTemplates`: List available standard metaobject templates

**Key Mutations**:
- `metaobjectDefinitionCreate`: Create new metaobject definition
- `metafieldDefinitionCreate`: Create new metafield definition
- `standardMetafieldDefinitionEnable`: Enable standard metafield definition
- `standardMetaobjectDefinitionEnable`: Enable standard metaobject definition

## File Structure in CLI Project

```
src/
├── index.ts                         # CLI entry point
├── types/
│   └── index.ts                     # TypeScript type definitions
├── commands/
│   ├── export.ts                    # Export command implementation
│   └── import.ts                    # Import command implementation
├── lib/
│   ├── shopify-client.ts           # GraphQL client setup
│   ├── queries.ts                  # GraphQL queries and mutations
│   ├── toml-parser.ts              # TOML parsing utilities
│   ├── file-operations.ts          # File read/write operations
│   ├── manifest.ts                 # Manifest management
│   ├── dependency-resolver.ts      # Dependency graph and resolution
│   ├── checksum.ts                 # Checksum calculation
│   ├── standard-definitions.ts     # Standard definition detection
│   └── interactive-prompts.ts      # User interaction utilities
└── utils/
    ├── validation.ts               # Input validation
    └── logger.ts                   # Logging utilities
```

## Error Handling

### Error Categories

1. **Authentication Errors**: Invalid shop domain or access token
2. **Network Errors**: API timeouts, connection failures
3. **Rate Limit Errors**: Shopify API rate limit exceeded
4. **Validation Errors**: Invalid TOML syntax, missing required fields
5. **Dependency Errors**: Missing dependencies, circular dependencies
6. **Conflict Errors**: Definition already exists in target store
7. **Permission Errors**: Insufficient API scopes

### Error Handling Strategy

- **Graceful Degradation**: Continue processing other definitions when one fails
- **Clear Error Messages**: Provide actionable information to user
- **Retry Logic**: Automatic retry for transient errors (network, rate limits)
- **Rollback**: No automatic rollback (imports are tracked, user can manually address)

## Future Enhancements

### Phase 4: Advanced Features

1. **Dependency Visualization**
   ```bash
   metaobject deps --graph
   metaobject deps --show typeface
   ```

2. **Local Validation**
   ```bash
   metaobject validate
   metaobject validate --definition metaobjects/products/typeface.toml
   ```

3. **Diff Command**
   ```bash
   metaobject diff --shop mystore.myshopify.com
   ```

4. **Sync Command**
   ```bash
   metaobject sync --shop mystore.myshopify.com
   # Two-way sync between local repo and remote store
   ```

5. **Watch Mode**
   ```bash
   metaobject watch --shop mystore.myshopify.com
   # Auto-export on changes in remote store
   ```

## Version Control Integration

### Git Workflow

1. **Initial Export**: Export definitions from source store
2. **Commit**: Commit to version control
   ```bash
   git add .
   git commit -m "feat: initial export of metaobject definitions"
   ```
3. **Make Changes**: Edit TOML files locally
4. **Validate**: Run validation command
5. **Import**: Import to target store(s)
6. **Commit**: Commit successful imports
   ```bash
   git add .
   git commit -m "feat: add typeface metaobject definition"
   ```

### Best Practices

- **Meaningful Commits**: Commit each logical change separately
- **Descriptive Messages**: Explain what changed and why
- **Branch Strategy**: Use feature branches for new definitions
- **Pull Requests**: Review changes before merging
- **Tags**: Tag versions for releases/deployments

## Security Considerations

1. **Access Tokens**: Never commit tokens to version control
   - Use `.env` files (gitignored)
   - Use environment variables
   - Use secure secret management

2. **API Scopes**: Require minimal scopes
   - `read_metaobjects` for export
   - `write_metaobjects` for import

3. **Validation**: Sanitize all user inputs
   - Validate shop domains
   - Validate file paths
   - Validate TOML syntax

4. **Rate Limiting**: Respect Shopify's rate limits to avoid account issues

## Testing Strategy

1. **Unit Tests**: Test individual utilities (TOML parsing, checksums, dependency graph)
2. **Integration Tests**: Test GraphQL queries with mocked responses
3. **End-to-End Tests**: Test full export/import workflow with test store
4. **Edge Cases**:
   - Empty definitions
   - Circular dependencies
   - Missing dependencies
   - Malformed TOML
   - Network failures
   - Rate limiting

## Glossary

- **Metaobject**: Custom content type in Shopify with defined fields
- **Metafield**: Additional data field attached to Shopify resources
- **Definition**: Schema describing a metaobject or metafield structure
- **Standard Definition**: Pre-configured definition provided by Shopify
- **Custom Definition**: User-created definition
- **Dependency**: Reference from one definition to another
- **Manifest**: Central file tracking all definitions and dependencies
- **Checksum**: Hash value for detecting file changes
- **Topological Sort**: Ordering algorithm for dependency resolution

## References

- [Shopify Custom Data Documentation](https://shopify.dev/docs/apps/build/custom-data)
- [Metafield Definitions](https://shopify.dev/docs/apps/build/custom-data/metafields/definitions)
- [Metaobject Definitions](https://shopify.dev/docs/apps/build/custom-data/metaobjects)
- [Standard Metafield Definitions](https://shopify.dev/docs/apps/build/custom-data/metafields/list-of-standard-definitions)
- [Standard Metaobject Definitions](https://shopify.dev/docs/apps/build/custom-data/metaobjects/list-of-standard-definitions)
- [TOML Specification](https://toml.io/)
- [Shopify GraphQL Admin API](https://shopify.dev/docs/api/admin-graphql)
