/**
 * Engine Factory
 *
 * Creates and initializes all Cloudflare bindings (D1, KV, R2) for use in the worker.
 * This factory is called once per worker instance and provides typed access to all resources.
 */
import { drizzle } from 'drizzle-orm/d1';
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
export async function createEngine(env, options = {}) {
  const { schema = {} } = options;
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
  const db = drizzle(env.DB, { schema });
  // Build the engine object with only defined properties
  const engine = { db };
  // Add optional bindings only if they exist
  if (env.KV) {
    engine.kv = env.KV;
  }
  if (env.R2) {
    engine.r2 = env.R2;
  }
  return engine;
}
//# sourceMappingURL=engine.js.map
