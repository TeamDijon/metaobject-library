# Shopify Metabridge

A powerful CLI tool for bridging and syncing Shopify metaobject definitions, metafield definitions, and entries across stores using TOML files. Export definitions from one store and import them into others with multi-source support, granular selection, automatic dependency resolution, and interactive conflict management.

## Features

- 🔄 **Multi-Source Architecture** - Import from remote repositories, local exports, or filesystem paths
- 📦 **Remote Repository Support** - Clone and cache GitHub repositories with configurable definitions
- 🎯 **Granular Selection** - Filter imports by type, category, or glob patterns
- 🔍 **Interactive Import** - Review, compare, and resolve conflicts before importing
- 📝 **TOML Format** - Human-readable, git-friendly definition files
- 🔗 **Dependency Resolution** - Automatic topological sorting and validation
- 📊 **Manifest Management** - Track versions, checksums, and dependencies
- ⚡ **Smart Caching** - Repository caching with configurable TTL
- 🎭 **Conflict Resolution** - Multiple strategies: prompt, skip, overwrite, abort
- 🔍 **Dry Run Mode** - Preview changes before applying them
- 📁 **Project-Local Storage** - Git-ignored `.metabridge/` directory per project

## Quick Start

### Installation

```bash
npm install -g shopify-metabridge
# Or install locally
npm install
npm run build
npm link
```

### Initialize a Project

```bash
# Initialize metabridge in your project
metabridge init

# Configure a remote repository for shared definitions
metabridge config set-repo https://github.com/myorg/shopify-definitions

# Optional: Add store aliases
metabridge config add-store production --shop mystore.myshopify.com
```

### Configuration

Create a `.env` file in your project:
```bash
SHOPIFY_SHOP=mystore.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxx
SHOPIFY_API_VERSION=2025-01  # Optional
GITHUB_TOKEN=ghp_xxxxx       # Optional, for private repos
```

## Usage Guide

### Project Initialization

```bash
# Initialize .metabridge/ structure
metabridge init
```

This creates:
```
.metabridge/
├── config.toml       # Per-project configuration
├── cache/            # Cached remote repositories
└── exports/          # Local exports from stores
```

### Configuration Commands

```bash
# Configure remote repository
metabridge config set-repo https://github.com/org/shopify-defs --branch main

# View configured repository
metabridge config get-repo

# Add store alias
metabridge config add-store staging --shop staging.myshopify.com --description "Staging store"

# List all store aliases
metabridge config list-stores

# Clear repository cache
metabridge config clear-cache

# Show all configuration
metabridge config show
```

### Export Command

Export metaobject and metafield definitions from a Shopify store:

```bash
# Export to .metabridge/exports/<shop-date>/ (default)
metabridge export --shop mystore.myshopify.com --token YOUR_TOKEN

# Named export (saves to .metabridge/exports/<name>/)
metabridge export --shop mystore --token YOUR_TOKEN --name production-backup

# Export to custom path (for sharing)
metabridge export --output ~/shared/definitions

# Export specific metaobject type
metabridge export --type typeface

# Export with custom category
metabridge export --category products

# Using environment variables
metabridge export
```

**Output Structure:**
```
.metabridge/exports/mystore-2025-10-27/
├── manifest.toml
├── metaobjects/
│   └── general/
│       ├── typeface.toml
│       └── hero_banner.toml
└── metafields/
    ├── product/
    │   └── key_features.toml
    └── shop/
        └── brand_settings.toml
```

### Import Command

Import definitions with granular control and conflict resolution:

```bash
# Import from configured repository
metabridge import --from repo

# Import from local export (by name)
metabridge import --from production-backup

# Import from filesystem path
metabridge import --from ./shared/definitions

# Selective import - specific types
metabridge import --from repo --type blog_author --type faq_item

# Selective import - by category
metabridge import --from repo --category content

# Selective import - by glob pattern
metabridge import --from repo --pattern "blog_*"

# Import with dependencies
metabridge import --from repo --type advanced_product --with-dependencies

# Import only dependencies (not the specified types)
metabridge import --from repo --type product_card --dependencies-only

# Exclude specific types or categories
metabridge import --from repo --all --exclude-type test_type --exclude-category test

# Non-interactive mode with conflict strategy
metabridge import --from repo --all --no-interactive --on-conflict skip

# Import to specific store alias
metabridge import --from repo --to staging

# Dry run - preview without changes
metabridge import --from repo --dry-run

# Interactive review (default if no --all flag)
metabridge import --from repo
```

**Import Features:**
- ✅ Automatic dependency resolution
- ✅ Topological sorting (dependencies imported first)
- ✅ Interactive conflict review and comparison
- ✅ Multiple conflict strategies
- ✅ Checksum validation
- ✅ Detailed import summary

### Source Management

```bash
# List all available sources
metabridge sources list

# Sync repository cache
metabridge sync

# Force sync even if cache is fresh
metabridge sync --force
```

**Example output:**
```
Available Sources:

📦 Repository:
  repo
    https://github.com/org/shopify-definitions (fresh, 15m ago)

📁 Local Exports:
  production-backup (valid)
  mystore-2025-10-27 (valid)
```

### Comparison and Utilities

```bash
# Compare two sources
metabridge diff --source1 repo --source2 production-backup

# Copy export to another location
metabridge copy --from production-backup --to ~/backups/definitions
```

## Typical Workflows

### Workflow 1: New Store Setup

```bash
# 1. Initialize in your project
cd my-shopify-theme
metabridge init

# 2. Configure shared repository
metabridge config set-repo https://github.com/myorg/shopify-definitions

# 3. Import base definitions
metabridge import --from repo --category base

# 4. Review and confirm
# Interactive prompts guide you through each definition
```

### Workflow 2: Migrate Between Projects

```bash
# In source project
metabridge export --shop source-store --name project-a

# Copy to another project (or use shared folder)
metabridge copy --from project-a --to ~/shared/project-a

# In target project
cd ../target-project
metabridge init
metabridge import --from ~/shared/project-a --type specific_type
```

### Workflow 3: Selective Updates

```bash
# Check what's different
metabridge diff --source1 repo --source2 production-backup

# Import only specific new features
metabridge import --from repo --pattern "feature_*" --with-dependencies

# Review in interactive mode
metabridge import --from repo --interactive
```

### Workflow 4: Repository-Based Development

```bash
# Clone your definitions repo
git clone https://github.com/org/shopify-definitions

# Edit definitions locally
cd shopify-definitions
# ... edit TOML files ...

# Import to dev store
metabridge import --from . --shop dev-store --dry-run
metabridge import --from . --shop dev-store

# Commit changes
git add .
git commit -m "feat: add new metaobject types"
git push

# Other team members sync
metabridge sync
metabridge import --from repo
```

## TOML File Format

### Metaobject Definition

```toml
# Metaobject: Typeface
# Category: products
# Version: 1.0.0

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

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for comprehensive documentation on:
- Multi-source architecture
- Repository structure
- File schemas
- Dependency resolution
- Interactive import workflow
- Caching strategy

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev -- init
npm run dev -- export --shop mystore
npm run dev -- import --from repo --dry-run

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format
```

## Shopify Setup

### Required API Scopes

Create a custom app in your Shopify admin with these scopes:
- `read_metaobjects` - Export metaobject definitions
- `write_metaobjects` - Create metaobject definitions
- `read_metafield_definitions` - Export metafield definitions
- `write_metafield_definitions` - Create metafield definitions

### Getting Your Access Token

1. Go to **Shopify Admin > Settings > Apps and sales channels**
2. Click **Develop apps**
3. Create a new app or select existing app
4. Configure Admin API scopes
5. Install the app
6. Copy the Admin API access token

## Commands Reference

| Command | Description |
|---------|-------------|
| `init` | Initialize .metabridge/ in current project |
| `config set-repo <url>` | Configure remote repository |
| `config get-repo` | Show configured repository |
| `config add-store <alias>` | Add store alias |
| `config list-stores` | List all store aliases |
| `config clear-cache` | Clear repository cache |
| `config show` | Show all configuration |
| `export` | Export definitions from Shopify |
| `import` | Import definitions to Shopify |
| `sync` | Update repository cache |
| `sources list` | List available sources |
| `diff` | Compare two sources |
| `copy` | Copy export between locations |

## Troubleshooting

### Common Issues

**Repository not configured:**
```
✗ No repository configured
```
Solution: `metabridge config set-repo <url>`

**Source not found:**
```
✗ Source "production" not found
```
Solution: Check available sources with `metabridge sources list`

**Missing Dependencies:**
```
⚠️ Definition 'key_features' has missing dependencies: typeface
```
Solution: Use `--with-dependencies` flag or import dependencies first

**Stale Cache:**
```
Cache is 2 hours old
```
Solution: Run `metabridge sync` to update

## Environment Variables

```bash
SHOPIFY_SHOP=mystore.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxx
SHOPIFY_API_VERSION=2025-01          # Optional
GITHUB_TOKEN=ghp_xxxxx               # Optional, for private repos
```

## Project Status

### ✅ Completed

- Multi-source architecture (remote repos, local exports, filesystem)
- Remote repository support with Git integration
- Granular import selection (type, category, pattern, exclusions)
- Interactive import with conflict resolution
- Dependency resolution and topological sorting
- Configuration management
- Smart caching with TTL
- Diff and comparison tools
- Export to `.metabridge/exports/`
- Comprehensive TOML format support
- Manifest management with checksums

### 🚧 Future Enhancements

- Comprehensive test coverage
- Standard definition enablement
- Dependency visualization
- Local validation command
- Watch mode for auto-export
- CI/CD integration examples
- Performance optimizations

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

ISC

## Links

- [Shopify Custom Data Documentation](https://shopify.dev/docs/apps/build/custom-data)
- [Metaobject Definitions](https://shopify.dev/docs/apps/build/custom-data/metaobjects)
- [Metafield Definitions](https://shopify.dev/docs/apps/build/custom-data/metafields/definitions)
- [TOML Specification](https://toml.io/)
