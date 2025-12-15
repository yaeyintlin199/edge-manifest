import { readFile } from 'node:fs/promises';
import type { FileLoader } from './config-parser.js';

export function createNodeFileLoader(): FileLoader {
  return {
    readFile: async (path: string) => readFile(path, 'utf-8'),
  };
}
