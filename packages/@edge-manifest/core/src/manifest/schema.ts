import * as v from './valibot.js';

const nonEmptyString = v.pipe(v.string(), v.minLength(1, 'Expected a non-empty string'));

const manifestRelationTypeSchema = v.union([v.literal('one'), v.literal('many')]);

const manifestRelationSchema = v.object({
  entity: nonEmptyString,
  field: v.optional(nonEmptyString),
  type: manifestRelationTypeSchema,
});

const scalarFieldKindSchema = v.union([
  v.literal('id'),
  v.literal('string'),
  v.literal('number'),
  v.literal('boolean'),
  v.literal('date'),
  v.literal('json'),
  v.literal('uuid'),
]);

const manifestScalarFieldSchema = v.object({
  name: nonEmptyString,
  kind: scalarFieldKindSchema,
  description: v.optional(nonEmptyString),
  required: v.optional(v.boolean()),
  unique: v.optional(v.boolean()),
  nullable: v.optional(v.boolean()),
  default: v.optional(v.unknown()),
});

const manifestRelationFieldSchema = v.object({
  name: nonEmptyString,
  kind: v.literal('relation'),
  relation: manifestRelationSchema,
  description: v.optional(nonEmptyString),
  required: v.optional(v.boolean()),
  unique: v.optional(v.boolean()),
  nullable: v.optional(v.boolean()),
  default: v.optional(v.unknown()),
});

const manifestFieldSchema = v.union([manifestRelationFieldSchema, manifestScalarFieldSchema]);

const manifestEntitySchema = v.object({
  name: nonEmptyString,
  table: v.optional(nonEmptyString),
  fields: v.pipe(v.array(manifestFieldSchema), v.minLength(1, 'Expected at least one field')),
});

export const edgeManifestSchema = v.object({
  id: nonEmptyString,
  name: nonEmptyString,
  version: nonEmptyString,
  generators: v.optional(v.record(v.string(), v.unknown())),
  entities: v.pipe(v.array(manifestEntitySchema), v.minLength(1, 'Expected at least one entity')),
  relations: v.optional(v.record(v.string(), v.unknown())),
});
