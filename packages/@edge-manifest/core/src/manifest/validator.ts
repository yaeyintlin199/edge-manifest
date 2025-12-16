import { edgeManifestSchema } from './schema.js';
import type { EdgeManifest } from './types.js';
import { safeParse } from './valibot.js';

type IssueLike = {
  message?: unknown;
  path?: unknown;
};

type PathItemLike = {
  key?: unknown;
};

function isIdentifier(key: string): boolean {
  return /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(key);
}

function formatPath(path: unknown): string {
  if (!Array.isArray(path) || path.length === 0) return '$';

  let out = '$';
  for (const segment of path) {
    let key: unknown = segment;

    if (segment && typeof segment === 'object') {
      const candidate = segment as PathItemLike;
      if ('key' in candidate) key = candidate.key;
    }

    if (typeof key === 'number') {
      out += `[${key}]`;
    } else if (typeof key === 'string') {
      out += /^\d+$/.test(key) ? `[${key}]` : isIdentifier(key) ? `.${key}` : `[${JSON.stringify(key)}]`;
    }
  }

  return out;
}

export function formatManifestError(issues: readonly unknown[]): string {
  const lines = issues
    .map((issue) => {
      if (!issue || typeof issue !== 'object') return null;
      const { message, path } = issue as IssueLike;

      const formattedPath = formatPath(path);
      const formattedMessage = typeof message === 'string' ? message : 'Invalid value';

      return `- ${formattedPath}: ${formattedMessage}`;
    })
    .filter((line): line is string => Boolean(line));

  return ['Manifest validation failed:', ...lines].join('\n');
}

function ensureUniqueNames(manifest: EdgeManifest): void {
  const entityNameToIndex = new Map<string, number>();

  for (const [entityIndex, entity] of manifest.entities.entries()) {
    const previous = entityNameToIndex.get(entity.name);
    if (previous !== undefined) {
      throw new Error(
        `Manifest validation failed:\n- $.entities[${entityIndex}].name: Duplicate entity name ${JSON.stringify(entity.name)} (already used at $.entities[${previous}].name)`,
      );
    }

    entityNameToIndex.set(entity.name, entityIndex);

    const fieldNameToIndex = new Map<string, number>();
    for (const [fieldIndex, field] of entity.fields.entries()) {
      const previousField = fieldNameToIndex.get(field.name);
      if (previousField !== undefined) {
        throw new Error(
          `Manifest validation failed:\n- $.entities[${entityIndex}].fields[${fieldIndex}].name: Duplicate field name ${JSON.stringify(field.name)} (already used at $.entities[${entityIndex}].fields[${previousField}].name)`,
        );
      }
      fieldNameToIndex.set(field.name, fieldIndex);

      if (field.kind === 'relation') {
        const relationEntity = field.relation.entity;
        const knownEntity =
          entityNameToIndex.has(relationEntity) || manifest.entities.some((e) => e.name === relationEntity);

        if (!knownEntity) {
          throw new Error(
            `Manifest validation failed:\n- $.entities[${entityIndex}].fields[${fieldIndex}].relation.entity: Unknown entity ${JSON.stringify(relationEntity)}`,
          );
        }
      }
    }
  }
}

export function validateManifest(manifest: unknown): EdgeManifest {
  const result = safeParse(edgeManifestSchema, manifest);

  if (!result.success) {
    throw new Error(formatManifestError(result.issues));
  }

  const parsed = result.output as EdgeManifest;
  ensureUniqueNames(parsed);

  return parsed;
}
