import { GraphQLClient } from 'graphql-request';
import type { ShopifyConfig } from '../types';

/**
 * Default Shopify Admin API version
 */
const DEFAULT_API_VERSION = '2024-10';

/**
 * Creates a GraphQL client configured for Shopify Admin API
 */
export function createShopifyClient(config: ShopifyConfig): GraphQLClient {
  const { shop, accessToken, apiVersion = DEFAULT_API_VERSION } = config;

  // Ensure shop domain has correct format
  const shopDomain = shop.includes('.myshopify.com') ? shop : `${shop}.myshopify.com`;

  const endpoint = `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`;

  return new GraphQLClient(endpoint, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Validates Shopify configuration
 */
export function validateConfig(config: Partial<ShopifyConfig>): config is ShopifyConfig {
  if (!config.shop) {
    throw new Error('Shop domain is required');
  }

  if (!config.accessToken) {
    throw new Error('Access token is required');
  }

  return true;
}
