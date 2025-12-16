import type { ManifestEntity, ManifestField } from '@edge-manifest/core';
import * as v from 'valibot';

/**
 * Generates Valibot validators for entity request bodies and query parameters
 */
export interface EntityValidators {
  createBody: v.GenericSchema;
  updateBody: v.GenericSchema;
  listQuery: v.GenericSchema;
}

/**
 * Generates validators for a manifest entity
 */
export function generateValidatorsForEntity(entity: ManifestEntity): EntityValidators {
  const bodyFields = generateBodyFieldSchemas(entity.fields);
  const queryFields = generateQueryFieldSchemas();

  return {
    createBody: v.object({
      ...bodyFields.required,
      ...bodyFields.optional,
    }),
    updateBody: v.object({
      ...bodyFields.optional,
    }),
    listQuery: v.object({
      ...queryFields,
    }),
  };
}

interface FieldSchemas {
  required: Record<string, v.GenericSchema>;
  optional: Record<string, v.GenericSchema>;
}

function generateBodyFieldSchemas(fields: ManifestField[]): FieldSchemas {
  const required: Record<string, v.GenericSchema> = {};
  const optional: Record<string, v.GenericSchema> = {};

  for (const field of fields) {
    if (field.kind === 'relation') {
      // Skip relation fields for now
      continue;
    }

    // Skip auto-generated timestamp fields
    if (field.name === 'createdAt' || field.name === 'updatedAt') {
      continue;
    }

    const fieldName = field.name;
    const schema = getFieldSchema(field.kind);

    if (!field.required && field.kind !== 'id') {
      optional[fieldName] = v.optional(schema);
    } else if (field.kind !== 'id') {
      required[fieldName] = schema;
    }
  }

  return { required, optional };
}

function generateQueryFieldSchemas(): Record<string, v.GenericSchema> {
  return {
    limit: v.optional(v.pipe(v.string(), v.transform(Number), v.integer(), v.minValue(1), v.maxValue(100))),
    offset: v.optional(v.pipe(v.string(), v.transform(Number), v.integer(), v.minValue(0))),
    sort: v.optional(v.string()),
    filter: v.optional(v.string()),
  };
}

function getFieldSchema(kind: string): v.GenericSchema {
  switch (kind) {
    case 'id':
    case 'uuid':
    case 'string':
      return v.string();

    case 'number':
      return v.number();

    case 'boolean':
      return v.boolean();

    case 'date':
      return v.string();

    case 'json':
      return v.unknown();

    default:
      return v.unknown();
  }
}

/**
 * Parses and validates a request body
 */
export async function validateBody<T extends v.GenericSchema>(schema: T, body: unknown): Promise<v.InferOutput<T>> {
  return v.parseAsync(schema, body);
}

/**
 * Parses and validates query parameters
 */
export async function validateQuery<T extends v.GenericSchema>(
  schema: T,
  params: Record<string, unknown>,
): Promise<v.InferOutput<T>> {
  return v.parseAsync(schema, params);
}
