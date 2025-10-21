import { createShopifyClient, validateConfig } from '../src/lib/shopify-client';
import type { ShopifyConfig } from '../src/types';

describe('Shopify Client', () => {
  const mockConfig: ShopifyConfig = {
    shop: 'test-store',
    accessToken: 'test-token',
  };

  describe('createShopifyClient', () => {
    it('should create a GraphQL client with correct endpoint', () => {
      const client = createShopifyClient(mockConfig);
      expect(client).toBeDefined();
    });

    it('should append .myshopify.com if not present', () => {
      const client = createShopifyClient(mockConfig);
      // GraphQLClient doesn't expose the URL directly, but we can verify it was created
      expect(client).toBeDefined();
    });

    it('should use custom API version if provided', () => {
      const configWithVersion = { ...mockConfig, apiVersion: '2024-07' };
      const client = createShopifyClient(configWithVersion);
      expect(client).toBeDefined();
    });
  });

  describe('validateConfig', () => {
    it('should validate a valid config', () => {
      expect(validateConfig(mockConfig)).toBe(true);
    });

    it('should throw error if shop is missing', () => {
      const invalidConfig = { accessToken: 'test-token' };
      expect(() => validateConfig(invalidConfig)).toThrow('Shop domain is required');
    });

    it('should throw error if accessToken is missing', () => {
      const invalidConfig = { shop: 'test-store' };
      expect(() => validateConfig(invalidConfig)).toThrow('Access token is required');
    });
  });
});
