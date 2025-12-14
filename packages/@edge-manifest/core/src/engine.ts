/**
 * Engine Factory
 *
 * Creates and initializes all Cloudflare bindings (D1, KV, R2) for use in the worker.
 * This factory is called once per worker instance and provides typed access to all resources.
 */

import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { drizzle } from 'drizzle-orm/d1';

/**
 * Bindings interface for Cloudflare Workers
 */
export interface EngineBindings {
  /** D1 Database binding */
  DB?: D1Database;
  /** KV Namespace binding */
  KV?: KVNamespace;
  /** R2 Bucket binding */
  R2?: R2Bucket;
  /** JWT secret for authentication */
  JWT_SECRET?: string;
  /** Additional environment variables */
  [key: string]: unknown;
}

/**
 * Engine instance with initialized clients
 */
export interface Engine<TSchema extends Record<string, unknown> = Record<string, never>> {
  /** Drizzle ORM instance connected to D1 */
  db: DrizzleD1Database<TSchema>;
  /** KV Namespace for key-value storage */
  kv?: KVNamespace;
  /** R2 Bucket for object storage */
  r2?: R2Bucket;
}

/**
 * Options for creating the engine
 */
export interface CreateEngineOptions<TSchema extends Record<string, unknown>> {
  /** Drizzle schema object containing table definitions */
  schema?: TSchema;
}

/**
 * Creates an engine instance with initialized Cloudflare bindings.
 *
 * This factory function takes environment bindings and initializes all clients
 * (D1, KV, R2) for use throughout the worker. The engine is typically created
 * once per worker instance and cached.
 *
 * @template TSchema - The Drizzle schema type
 * @param env - Cloudflare environment bindings
 * @param options - Optional configuration including Drizzle schema
 * @returns Engine instance with initialized clients
 *
 * @example
 * ```typescript
 * import { createEngine } from '@edge-manifest/core';
 * import * as schema from './schema';
 *
 * const engine = await createEngine(env, { schema });
 * const users = await engine.db.query.users.findMany();
 * ```
 */
export async function createEngine<TSchema extends Record<string, unknown> = Record<string, never>>(
  env: EngineBindings,
  options: CreateEngineOptions<TSchema> = {},
): Promise<Engine<TSchema>> {
  const { schema = {} as TSchema } = options;

  // Initialize D1 Database
  if (!env.DB) {
    throw new Error(
      'D1 binding (DB) not found in environment. ' +
        'Make sure your wrangler.toml includes:\n' +
        '[[d1_databases]]\n' +
        'binding = "DB"\n' +
        'database_name = "your-database"\n' +
        'database_id = "your-database-id"',
    );
  }

  const db = drizzle(env.DB, { schema }) as DrizzleD1Database<TSchema>;

  // Build the engine object with only defined properties
  const engine: Engine<TSchema> = { db };

  // Add optional bindings only if they exist
  if (env.KV) {
    engine.kv = env.KV;
  }

  if (env.R2) {
    engine.r2 = env.R2;
  }

  return engine;
}
