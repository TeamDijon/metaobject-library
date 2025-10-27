/**
 * GraphQL queries and mutations for Shopify Admin API
 */

/**
 * Query to fetch all metaobject definitions
 */
export const METAOBJECT_DEFINITIONS_QUERY = `
  query MetaobjectDefinitions($first: Int!, $after: String) {
    metaobjectDefinitions(first: $first, after: $after) {
      edges {
        node {
          id
          type
          name
          description
          displayNameKey
          access {
            admin
            storefront
          }
          capabilities {
            translatable {
              enabled
            }
            publishable {
              enabled
            }
            renderable {
              enabled
            }
          }
          fieldDefinitions {
            key
            name
            description
            type {
              name
            }
            required
            validations {
              name
              value
            }
          }
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

/**
 * Query to fetch metafield definitions for a specific resource type
 */
export const METAFIELD_DEFINITIONS_QUERY = `
  query MetafieldDefinitions($ownerType: MetafieldOwnerType!, $first: Int!, $after: String) {
    metafieldDefinitions(ownerType: $ownerType, first: $first, after: $after) {
      edges {
        node {
          id
          namespace
          key
          name
          description
          type {
            name
          }
          validations {
            name
            value
          }
          access {
            admin
            storefront
          }
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

/**
 * Query to fetch a single metaobject definition by type
 */
export const METAOBJECT_DEFINITION_BY_TYPE_QUERY = `
  query MetaobjectDefinitionByType($type: String!) {
    metaobjectDefinitionByType(type: $type) {
      id
      type
      name
      description
      displayNameKey
      access {
        admin
        storefront
      }
      capabilities {
        translatable {
          enabled
        }
        publishable {
          enabled
        }
        renderable {
          enabled
        }
      }
      fieldDefinitions {
        key
        name
        description
        type {
          name
        }
        required
        validations {
          name
          value
        }
      }
    }
  }
`;

/**
 * Query to fetch standard metafield definition templates
 */
export const STANDARD_METAFIELD_TEMPLATES_QUERY = `
  query StandardMetafieldDefinitionTemplates {
    standardMetafieldDefinitionTemplates {
      edges {
        node {
          id
          name
          description
          namespace
          key
          type {
            name
          }
          ownerTypes
        }
      }
    }
  }
`;

/**
 * Query to fetch standard metaobject definition templates
 */
export const STANDARD_METAOBJECT_TEMPLATES_QUERY = `
  query StandardMetaobjectDefinitionTemplates {
    standardMetaobjectDefinitionTemplates {
      edges {
        node {
          id
          type
          name
          description
        }
      }
    }
  }
`;

/**
 * Mutation to create a metaobject definition
 */
export const CREATE_METAOBJECT_DEFINITION_MUTATION = `
  mutation CreateMetaobjectDefinition($definition: MetaobjectDefinitionCreateInput!) {
    metaobjectDefinitionCreate(definition: $definition) {
      metaobjectDefinition {
        id
        type
        name
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

/**
 * Mutation to create a metafield definition
 */
export const CREATE_METAFIELD_DEFINITION_MUTATION = `
  mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition {
        id
        namespace
        key
        name
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

/**
 * Mutation to enable a standard metafield definition
 */
export const ENABLE_STANDARD_METAFIELD_MUTATION = `
  mutation EnableStandardMetafieldDefinition($templateId: ID!, $ownerType: MetafieldOwnerType!) {
    standardMetafieldDefinitionEnable(
      templateId: $templateId
      ownerType: $ownerType
    ) {
      metafieldDefinition {
        id
        namespace
        key
        name
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

/**
 * Mutation to enable a standard metaobject definition
 */
export const ENABLE_STANDARD_METAOBJECT_MUTATION = `
  mutation EnableStandardMetaobjectDefinition($templateId: ID!) {
    standardMetaobjectDefinitionEnable(templateId: $templateId) {
      metaobjectDefinition {
        id
        type
        name
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

/**
 * Shopify resource types for metafield definitions
 */
export const METAFIELD_OWNER_TYPES = [
  'PRODUCT',
  'PRODUCTVARIANT',
  'COLLECTION',
  'CUSTOMER',
  'ORDER',
  'SHOP',
  'ARTICLE',
  'BLOG',
  'PAGE',
  'LOCATION',
] as const;

export type MetafieldOwnerType = (typeof METAFIELD_OWNER_TYPES)[number];
