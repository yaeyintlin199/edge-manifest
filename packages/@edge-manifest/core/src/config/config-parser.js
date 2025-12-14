import { validateManifest } from '../manifest/validator';
export class ConfigParser {
  _config;
  loader;
  constructor(loader) {
    this.loader = loader || createDefaultFileLoader();
  }
  async loadFromFile(path, options) {
    try {
      const fileContent = await this.loader.readFile(path);
      // Parse JSON with structured error handling
      let manifest;
      try {
        manifest = JSON.parse(fileContent);
      } catch (parseError) {
        const error = parseError;
        throw new Error(`Failed to parse manifest JSON from ${path}:\n` + `- Invalid JSON syntax: ${error.message}`);
      }
      return this.loadFromObject(manifest, { ...options, sourcePath: path });
    } catch (error) {
      // Don't wrap file system errors - let them bubble up with original message
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('ENOENT') || errorMessage.includes('no such file')) {
        throw error; // Preserve original file system error
      }
      // For other errors, enhance with source path
      throw new Error(`Failed to load manifest from ${path}:\n` + `- ${errorMessage}`);
    }
  }
  loadFromObject(manifestLike, options) {
    try {
      // Validate the manifest using existing validator
      const validatedManifest = validateManifest(manifestLike);
      // Apply runtime overrides if provided
      const mergedConfig = this.mergeWithOverrides(validatedManifest, options?.runtimeOverrides);
      // Create result with metadata
      const result = {
        ...mergedConfig,
        _meta: {
          loadedAt: new Date(),
          ...(options?.sourcePath && { sourcePath: options.sourcePath }),
          ...(options?.runtimeOverrides && { runtimeOverrides: options.runtimeOverrides }),
        },
      };
      this._config = result;
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const sourcePath = options?.sourcePath ? ` from ${options.sourcePath}` : '';
      throw new Error(`Failed to load manifest${sourcePath}:\n` + `- ${errorMessage}`);
    }
  }
  getConfig() {
    return this._config;
  }
  mergeWithOverrides(manifest, runtimeOverrides) {
    if (!runtimeOverrides) {
      return manifest;
    }
    // Create a new object to avoid mutating the original manifest
    const merged = { ...manifest };
    // Apply runtime overrides
    if (runtimeOverrides.defaultRegion) {
      // Add default region to generators if not present
      if (!merged.generators) {
        merged.generators = {};
      }
      // biome-ignore lint/complexity/useLiteralKeys: TypeScript strict mode requires bracket notation for index signatures
      merged.generators['defaultRegion'] = runtimeOverrides.defaultRegion;
    }
    if (runtimeOverrides.generatorFlags) {
      if (!merged.generators) {
        merged.generators = {};
      }
      // Merge generator flags
      merged.generators = {
        ...merged.generators,
        ...runtimeOverrides.generatorFlags,
      };
    }
    // Allow other runtime overrides to be applied
    for (const [key, value] of Object.entries(runtimeOverrides)) {
      if (key !== 'defaultRegion' && key !== 'generatorFlags') {
        if (!merged.generators) {
          merged.generators = {};
        }
        merged.generators[key] = value;
      }
    }
    return merged;
  }
}
function createDefaultFileLoader() {
  // Dynamic import to avoid Node.js dependencies in bundle
  return {
    async readFile(path) {
      if (typeof globalThis !== 'undefined' && 'fetch' in globalThis) {
        // Workers environment - this would need a custom implementation
        // For now, throw a helpful error
        throw new Error(
          'File loading not available in this environment. ' +
            'Please provide a custom FileLoader for Workers environment.',
        );
      }
      if (typeof globalThis.Bun !== 'undefined') {
        // Bun environment
        const { readFile } = await import('node:fs/promises');
        return readFile(path, 'utf-8');
      }
      if (typeof process !== 'undefined' && process.versions?.node) {
        // Node.js environment
        const { readFile } = await import('node:fs/promises');
        return readFile(path, 'utf-8');
      }
      throw new Error(
        'Unsupported environment for file loading. ' + 'Please provide a custom FileLoader implementation.',
      );
    },
  };
}
//# sourceMappingURL=config-parser.js.map
