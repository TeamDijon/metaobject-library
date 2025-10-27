# Shopify Metabridge

A powerful CLI tool for bridging and syncing Shopify metaobject definitions, metafield definitions, and entries across stores using TOML files. Export definitions from one store and import them into others, with automatic dependency resolution and version control integration.

## Features

- 🔄 **Export/Import** - Migrate metaobject and metafield definitions between stores
- 📝 **TOML Format** - Shopify-native format for human-readable, git-friendly definitions
- 🔗 **Dependency Resolution** - Automatic topological sorting and validation
- 📦 **Manifest Management** - Track versions, checksums, and dependencies
- ⚡ **Standard Definitions** - Recognition and handling of Shopify standard definitions
- 🎯 **Interactive Prompts** - User-friendly conflict resolution
- 🔍 **Dry Run Mode** - Preview changes before applying them
- 📊 **Category Organization** - Organize definitions by category

## Quick Start

### Installation

```bash
npm install
npm run build
```

### Configuration

```bash
cp .env.example .env
# Edit .env and add your Shopify credentials:
# - SHOPIFY_SHOP=mystore.myshopify.com
# - SHOPIFY_ACCESS_TOKEN=shpat_xxxxx
```

### Basic Usage

**Export from source store:**
```bash
metabridge export --output ./shopify-definitions
```

**Import to target store:**
```bash
metabridge import --shop newstore.myshopify.com --token YOUR_TOKEN --dry-run
metabridge import --shop newstore.myshopify.com --token YOUR_TOKEN
```

## Usage Guide

### Export Command

Export metaobject and metafield definitions from a Shopify store:

```bash
# Export all definitions to default directory (./shopify-definitions)
metabridge export

# Export to custom directory
metabridge export --output /path/to/my-definitions-repo

# Export specific metaobject type
metabridge export --type typeface

# Export with custom category
metabridge export --category products

# Use CLI flags instead of .env
metabridge export --shop mystore --token shpat_xxxxx
```

**Output Structure:**
```
shopify-definitions/
├── manifest.toml                    # Version tracking and dependencies
├── metaobjects/
│   └── general/
│       ├── typeface.toml
│       └── hero_banner.toml
└── metafields/
    ├── product/
    │   └── key_features.toml
    ├── variant/
    ├── collection/
    └── shop/
        └── brand_settings.toml
```

### Import Command

Import definitions from a TOML repository to a Shopify store:

```bash
# Dry run - preview changes without applying
metabridge import --dry-run

# Import all definitions
metabridge import

# Import from custom directory
metabridge import --input /path/to/my-definitions-repo

# Import to different store
metabridge import --shop targetstore --token shpat_yyyyy
```

**Features:**
- ✅ Automatic dependency resolution
- ✅ Topological sorting (dependencies imported first)
- ✅ Conflict detection and interactive prompts
- ✅ Checksum validation
- ✅ Detailed import summary

### Environment Variables

```bash
SHOPIFY_SHOP=mystore.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxx
SHOPIFY_API_VERSION=2025-01  # Optional, defaults to 2025-01
```

## TOML File Format

### Metaobject Definition

```toml
# Metaobject: Typeface
# Category: products
# Version: 1.0.0
# Last Modified: 2025-10-21T10:30:00Z

[definition]
type = "typeface"
name = "Typeface"
description = "Font family definitions"
display_name_field = "font_family"
category = "products"

[definition.access]
admin = "merchant_read_write"
storefront = "public_read"

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
type = "list.metaobject_reference<$app:typeface>"
resource = "product"
category = "products"

[definition.access]
storefront = "public_read"

[dependencies]
metaobjects = ["typeface"]
metafields = []
standard_metafields = ["reviews.rating"]
standard_metaobjects = []
```

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for comprehensive documentation on:
- Repository structure
- File schemas
- Dependency resolution strategy
- Standard definitions handling
- Import/export workflows

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev -- export
npm run dev -- import --dry-run

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

To use this tool, create a custom app in your Shopify admin with these scopes:
- `read_metaobjects` - Export metaobject definitions
- `write_metaobjects` - Create metaobject definitions
- `read_metafield_definitions` - Export metafield definitions (implied)
- `write_metafield_definitions` - Create metafield definitions (implied)

### Getting Your Access Token

1. Go to **Shopify Admin > Settings > Apps and sales channels**
2. Click **Develop apps**
3. Create a new app or select existing app
4. Configure Admin API scopes (select scopes above)
5. Install the app
6. Copy the Admin API access token

## Workflow Best Practices

### Recommended Setup

1. **Create a dedicated definitions repository:**
   ```bash
   mkdir shopify-definitions
   cd shopify-definitions
   git init
   ```

2. **Export from your source store:**
   ```bash
   metabridge export --output .
   ```

3. **Commit to version control:**
   ```bash
   git add .
   git commit -m "feat: initial export of metaobject definitions"
   ```

4. **Import to target stores:**
   ```bash
   metabridge import --shop newstore --token TOKEN --dry-run
   metabridge import --shop newstore --token TOKEN
   ```

### Version Control Integration

- Store definitions in a dedicated Git repository
- Use meaningful commit messages
- Review diffs before importing
- Tag versions for releases
- Use branches for testing new definitions

## Troubleshooting

### Common Issues

**Authentication Errors:**
```
Error: Shop domain is required
```
Solution: Set `SHOPIFY_SHOP` in `.env` or use `--shop` flag

**Missing Dependencies:**
```
⚠️  Definition 'key_features' has missing dependencies: typeface
```
Solution: Ensure all dependencies are included in the import set

**Circular Dependencies:**
```
❌ Circular dependency detected: A -> B -> A
```
Solution: Review and fix circular references in your definitions

## Project Status

### ✅ Completed

- Project structure and configuration
- CLI framework with commander.js
- TypeScript setup with strict type checking
- TOML parser integration (@iarna/toml)
- Comprehensive type definitions
- File operations (read/write TOML, checksums)
- Manifest management
- Dependency graph builder and resolver
- Standard definitions recognition
- GraphQL queries and mutations
- **Export command** - Fully functional
- **Import command** - Fully functional with interactive prompts
- Dry run mode
- Checksum validation
- Architecture documentation

### 🚧 Future Enhancements

- Standard definition enablement during import
- Dependency visualization (`metabridge deps --graph`)
- Local validation (`metabridge validate`)
- Diff command (`metabridge diff`)
- Two-way sync (`metabridge sync`)
- Watch mode for auto-export
- Comprehensive test coverage
- CI/CD integration examples

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
