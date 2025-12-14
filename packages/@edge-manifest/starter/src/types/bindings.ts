import type { EdgeManifest } from '@edge-manifest/core';

export interface Bindings {
  /** D1 Database binding */
  DB?: D1Database;

  /** KV Namespace binding */
  KV?: KVNamespace;

  /** R2 Bucket binding */
  R2?: R2Bucket;

  /**
   * Optional manifest injection.
   *
   * - string: JSON encoded EdgeManifest
   * - object: EdgeManifest-like
   */
  EDGE_MANIFEST?: string | EdgeManifest;
  MANIFEST?: string | EdgeManifest;

  /** JWT secret for authentication */
  JWT_SECRET?: string;

  /** Wrangler AI binding (optional in local dev) */
  ai?: unknown;

  /** Additional environment variables */
  [key: string]: unknown;
}
