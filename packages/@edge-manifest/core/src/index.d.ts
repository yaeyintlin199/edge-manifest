/**
 * EDGE-MANIFEST Core API
 *
 * This module provides the core functionality for EDGE-MANIFEST.
 * Currently stubbed pending core feature implementation.
 */
export type CoreConfig = Record<string, unknown>;
export declare function createCore(config: CoreConfig): {
  config: CoreConfig;
};
export * from './config/config-parser';
export * from './db/d1-handler';
export * from './engine';
export * from './manifest/types';
export * from './manifest/validator';
//# sourceMappingURL=index.d.ts.map
