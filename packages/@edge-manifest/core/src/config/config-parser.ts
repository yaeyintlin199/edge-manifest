import type { EdgeManifest } from '../manifest/types.js';
import { validateManifest } from '../manifest/validator.js';

export interface RuntimeOverrides {
  defaultRegion?: string;
  generatorFlags?: Record<string, boolean>;
  [key: string]: unknown;
}

export interface ConfigParserOptions {
  runtimeOverrides?: RuntimeOverrides;
}

export interface LoadOptions extends ConfigParserOptions {
  sourcePath?: string;
}

export interface ConfigParserResult extends EdgeManifest {
  _meta: {
    sourcePath?: string;
    runtimeOverrides?: RuntimeOverrides;
    loadedAt: Date;
  };
}

export interface FileLoader {
  readFile(path: string): Promise<string>;
}

export class ConfigParser {
  private _config?: ConfigParserResult;
  private readonly loader?: FileLoader;

  constructor(loader?: FileLoader) {
    this.loader = loader;
  }

  async loadFromFile(path: string, options?: ConfigParserOptions): Promise<ConfigParserResult> {
    if (!this.loader) {
      throw new Error(
        'File loading is not available in this runtime. ' +
          'Use loadFromObject() in edge/worker environments, or provide a FileLoader (e.g. createNodeFileLoader from @edge-manifest/core/node).',
      );
    }

    try {
      const fileContent = await this.loader.readFile(path);

      // Parse JSON with structured error handling
      let manifest: unknown;
      try {
        manifest = JSON.parse(fileContent);
      } catch (parseError) {
        const error = parseError as Error;
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

  loadFromObject(manifestLike: unknown, options?: LoadOptions): ConfigParserResult {
    try {
      // Validate the manifest using existing validator
      const validatedManifest = validateManifest(manifestLike);

      // Apply runtime overrides if provided
      const mergedConfig = this.mergeWithOverrides(validatedManifest, options?.runtimeOverrides);

      // Create result with metadata
      const result: ConfigParserResult = {
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

  getConfig(): ConfigParserResult | undefined {
    return this._config;
  }

  private mergeWithOverrides(manifest: EdgeManifest, runtimeOverrides?: RuntimeOverrides): EdgeManifest {
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
      (merged.generators as Record<string, unknown>)['defaultRegion'] = runtimeOverrides.defaultRegion;
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
        (merged.generators as Record<string, unknown>)[key] = value;
      }
    }

    return merged;
  }
}
