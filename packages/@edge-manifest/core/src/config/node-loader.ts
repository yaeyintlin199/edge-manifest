/**
 * Node.js FileLoader - DO NOT IMPORT IN WORKER CODE
 * This module is for CLI/build tools only
 */

import type { FileLoader } from './config-parser';

/**
 * Creates a FileLoader for Node.js/Bun environments
 * @warning Only use in CLI/build tools, not in Workers runtime
 */
export async function createNodeFileLoader(): Promise<FileLoader> {
  const { readFile } = await import('node:fs/promises');

  return {
    async readFile(path: string): Promise<string> {
      return readFile(path, 'utf-8');
    },
  };
}
