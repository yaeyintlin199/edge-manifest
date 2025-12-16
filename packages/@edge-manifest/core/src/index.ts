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

export * from './config/config-parser';
export * from './db/d1-handler';
export * from './engine';
export * from './manifest/types';
export * from './manifest/validator';
