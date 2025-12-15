import type { ConfigParserResult } from '@edge-manifest/core';
import type { Bindings } from './types';

/**
 * Generate and run migrations from the manifest
 */
export async function runMigrations(env: Bindings, manifest: ConfigParserResult): Promise<void> {
  if (!env.DB) {
    throw new Error('D1 binding not available');
  }

  const db = env.DB;

  // Generate SQL for each entity
  for (const entity of manifest.entities) {
    const tableName = entity.table || entity.name.toLowerCase();

    // Build CREATE TABLE statement
    const fields: string[] = [];
    let hasPrimaryKey = false;

    for (const field of entity.fields) {
      if (field.kind === 'relation') continue;

      let sqlType = '';
      let constraints = '';

      switch (field.kind) {
        case 'id':
        case 'uuid':
          sqlType = 'TEXT';
          // Only the first id/uuid field becomes PRIMARY KEY
          if (!hasPrimaryKey && field.name === 'id') {
            constraints = 'PRIMARY KEY';
            hasPrimaryKey = true;
          }
          break;
        case 'string':
          sqlType = 'TEXT';
          break;
        case 'number':
          sqlType = 'REAL';
          break;
        case 'boolean':
          sqlType = 'INTEGER';
          break;
        case 'date':
          sqlType = 'TEXT';
          break;
        case 'json':
          sqlType = 'TEXT';
          break;
        default:
          // Exhaustive check - should never reach here
          throw new Error(`Unsupported field kind: ${String((field as { kind: string }).kind)}`);
      }

      if (field.required && field.kind !== 'id' && field.kind !== 'uuid') {
        constraints += ' NOT NULL';
      }

      if (field.unique && field.kind !== 'id' && field.kind !== 'uuid') {
        constraints += ' UNIQUE';
      }

      if (field.default !== undefined && field.kind !== 'id' && field.kind !== 'uuid') {
        if (typeof field.default === 'string') {
          constraints += ` DEFAULT '${field.default}'`;
        } else if (typeof field.default === 'boolean') {
          constraints += ` DEFAULT ${field.default ? 1 : 0}`;
        } else {
          constraints += ` DEFAULT ${field.default}`;
        }
      }

      fields.push(`${field.name} ${sqlType}${constraints ? ` ${constraints.trim()}` : ''}`);
    }

    // Add timestamps
    fields.push('created_at TEXT DEFAULT CURRENT_TIMESTAMP');
    fields.push('updated_at TEXT DEFAULT CURRENT_TIMESTAMP');

    const createTableSQL = `CREATE TABLE IF NOT EXISTS ${tableName} (
  ${fields.join(',\n  ')}
);`;

    // Execute migration
    await db.prepare(createTableSQL).run();

    console.log(`Created table: ${tableName}`);
  }
}

/**
 * Check if migrations need to be run
 */
export async function needsMigrations(env: Bindings, manifest: ConfigParserResult): Promise<boolean> {
  if (!env.DB) {
    return false;
  }

  try {
    // Check if the first entity table exists
    if (manifest.entities.length > 0) {
      const tableName = manifest.entities[0]?.table || manifest.entities[0]?.name.toLowerCase();
      const result = await env.DB.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
        .bind(tableName)
        .first();

      return !result; // Need migrations if table doesn't exist
    }
  } catch (error) {
    console.error('Error checking migrations:', error);
  }

  return false;
}
