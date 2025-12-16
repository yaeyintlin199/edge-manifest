/**
 * EDGE-MANIFEST Core API
 *
 * This module provides the core functionality for EDGE-MANIFEST.
 * Currently stubbed pending core feature implementation.
 */

export type CoreConfig = Record<string, unknown>;

export function createCore(config: CoreConfig) {
  return {
    config,
  };
}

export * from './config/config-parser.js';
export * from './db/d1-handler.js';
export * from './manifest/types.js';
export * from './manifest/validator.js';
