# Metaobject Library

CLI tool for migrating Shopify metaobject definitions between stores using the Shopify GraphQL Admin API.

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure credentials**
   ```bash
   cp .env.example .env
   # Edit .env and add your Shopify shop domain and access token
   ```

3. **Export metaobject definitions**
   ```bash
   npm run dev -- export --output ./metaobjects
   ```

4. **Import to another store**
   ```bash
   npm run dev -- import --shop newstore.myshopify.com --token YOUR_TOKEN --input ./metaobjects
   ```

## Development

```bash
# Build the project
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format
```

## Shopify Setup

To use this tool, you need a Shopify Admin API access token with the following scopes:
- `read_metaobjects` - for export functionality
- `write_metaobjects` - for import functionality

Get your access token from: **Shopify Admin > Settings > Apps and sales channels > Develop apps**

## Project Status

This project is currently in early development. Core functionality is being implemented.

### Completed
- Project structure and configuration
- CLI framework with commander.js
- TypeScript setup with strict type checking
- Jest testing framework
- ESLint and Prettier for code quality
- Basic command structure (export/import)

### In Progress
- GraphQL query implementation
- Export functionality
- Import functionality
- Error handling and retry logic
- Comprehensive test coverage

## License

ISC
