import {
  ConfigParser,
  type ConfigParserResult,
  createD1RequestHandler,
  type D1Bindings,
  type TypedDrizzleD1,
} from '@edge-manifest/core';
import { cors } from '@elysiajs/cors';
import { Elysia } from 'elysia';
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker';
import * as v from 'valibot';
import { issueJWT, refreshJWT, verifyJWT } from './auth.js';
import { registerCrudRoutes } from './routes.js';
import type { Bindings } from './types.js';

type EmptySchema = Record<string, never>;

const emptySchema = {} as EmptySchema;

type Db = TypedDrizzleD1<EmptySchema>;

function createRequestId(): string {
  return crypto.randomUUID();
}

function defaultManifest(): ConfigParserResult {
  return new ConfigParser().loadFromObject({
    id: 'edge-manifest',
    name: 'EDGE-MANIFEST Worker',
    version: '0.0.0',
    entities: [
      {
        name: 'Health',
        fields: [{ name: 'id', kind: 'id' }],
      },
    ],
  });
}

function loadManifestFromEnv(env: Bindings): {
  manifest: ConfigParserResult;
  error?: Error;
} {
  const source = env.EDGE_MANIFEST ?? env.MANIFEST;

  if (!source) {
    return { manifest: defaultManifest() };
  }

  try {
    const manifestLike = typeof source === 'string' ? JSON.parse(source) : source;
    const parser = new ConfigParser();
    return { manifest: parser.loadFromObject(manifestLike, { sourcePath: 'env' }) };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return { manifest: defaultManifest(), error: err };
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function createApp(env: Bindings): Promise<ReturnType<typeof createAppInternal>> {
  const { manifest, error: manifestError } = loadManifestFromEnv(env);
  const app = createAppInternal(env, manifest, manifestError);

  // Register CRUD routes for entities in manifest
  if (!manifestError) {
    await registerCrudRoutes(app as any, manifest);
  }

  return app.compile();
}

function getJWTSecret(env: Bindings): string {
  return env.JWT_SECRET ?? 'default-dev-secret-change-in-production';
}

function createAppInternal(env: Bindings, manifest: ConfigParserResult, manifestError?: Error) {
  const d1Handler = createD1RequestHandler({ schema: emptySchema });

  const baseApp = new Elysia({ adapter: CloudflareAdapter })
    .decorate('env', env)
    .decorate('manifest', manifest)
    .decorate('manifestError', manifestError)
    .decorate('requestId', '')
    .decorate('requestStartMs', 0)
    .decorate('db', undefined as Db | undefined)
    .decorate('dbError', undefined as Error | undefined)
    .decorate('user', null as Record<string, unknown> | null)
    .use(
      cors({
        origin: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['content-type', 'authorization', 'x-request-id'],
        exposeHeaders: ['x-request-id'],
      }),
    )
    .onRequest(async (ctx) => {
      ctx.requestId = createRequestId();
      ctx.requestStartMs = Date.now();
      ctx.set.headers['x-request-id'] = ctx.requestId;

      try {
        const result = await d1Handler({}, ctx.env as D1Bindings);
        ctx.db = result.db as Db;
        ctx.dbError = undefined;
      } catch (error) {
        ctx.db = undefined;
        ctx.dbError = error instanceof Error ? error : new Error(String(error));
      }

      console.info(
        JSON.stringify({
          level: 'info',
          msg: 'request.start',
          requestId: ctx.requestId,
          method: ctx.request.method,
          url: ctx.request.url,
        }),
      );
    })
    .onAfterHandle(
      (() => {
        return (ctx: any) => {
          const durationMs = Date.now() - ctx.requestStartMs;

          console.info(
            JSON.stringify({
              level: 'info',
              msg: 'request.end',
              requestId: ctx.requestId,
              method: ctx.request.method,
              url: ctx.request.url,
              status: ctx.set.status,
              durationMs,
            }),
          );
        };
      })() as any,
    )
    .derive(async (ctx: any) => {
      // Extract JWT from Authorization header
      const authHeader = ctx.request.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { user: null };
      }

      const token = authHeader.substring(7);
      const secret = getJWTSecret(ctx.env);
      const payload = await verifyJWT(token, secret);

      return { user: payload };
    })
    .onError((ctx) => {
      if (!ctx.requestId) {
        ctx.requestId = createRequestId();
        ctx.set.headers['x-request-id'] = ctx.requestId;
      }

      if (!ctx.requestStartMs) {
        ctx.requestStartMs = Date.now();
      }

      const durationMs = Date.now() - ctx.requestStartMs;

      console.error(
        JSON.stringify({
          level: 'error',
          msg: 'request.error',
          requestId: ctx.requestId,
          method: ctx.request.method,
          url: ctx.request.url,
          code: ctx.code,
          status: ctx.set.status,
          durationMs,
          error: toErrorMessage(ctx.error),
        }),
      );

      ctx.set.headers['content-type'] = 'application/json';
      ctx.set.headers['x-request-id'] = ctx.requestId;

      return {
        ok: false,
        requestId: ctx.requestId,
        error: {
          code: String(ctx.code ?? 'ERROR'),
          message: toErrorMessage(ctx.error),
        },
      };
    })
    .get('/health', ({ requestId, manifestError }) => ({
      ok: true,
      requestId,
      manifestLoaded: !manifestError,
    }))
    .get('/ready', async ({ env, dbError, requestId, set }) => {
      if (!env.DB) {
        set.status = 503;
        return {
          ok: false,
          requestId,
          ready: false,
          reason: 'D1 binding (DB) is missing',
        };
      }

      if (dbError) {
        set.status = 503;
        return {
          ok: false,
          requestId,
          ready: false,
          reason: dbError.message,
        };
      }

      try {
        const row = await env.DB.prepare('SELECT 1 as ok').first<{ ok: number }>();

        if (!row || row.ok !== 1) {
          set.status = 503;
          return {
            ok: false,
            requestId,
            ready: false,
            reason: 'Unexpected D1 response',
          };
        }

        return {
          ok: true,
          requestId,
          ready: true,
        };
      } catch (error) {
        set.status = 503;
        return {
          ok: false,
          requestId,
          ready: false,
          reason: toErrorMessage(error),
        };
      }
    })
    .post(
      '/auth/login',
      async ({ body, env, requestId, set }) => {
        const loginSchema = v.object({
          email: v.pipe(v.string(), v.email()),
          password: v.string(),
        });

        try {
          const { email } = await v.parseAsync(loginSchema, body);

          // Placeholder auth: accept any email/password
          const secret = getJWTSecret(env);
          const token = await issueJWT({ userId: email, iat: Date.now() }, secret);

          return {
            ok: true,
            requestId,
            token,
            expiresIn: 3600, // 1 hour in seconds
          };
        } catch (error) {
          set.status = 400;
          return {
            ok: false,
            requestId,
            error: {
              code: 'VALIDATION_ERROR',
              message: toErrorMessage(error),
            },
          };
        }
      },
      {
        body: v.object({
          email: v.string(),
          password: v.string(),
        }),
      },
    )
    .post(
      '/auth/refresh',
      async ({ body, env, requestId, set }) => {
        const refreshSchema = v.object({
          token: v.string(),
        });

        try {
          const { token } = await v.parseAsync(refreshSchema, body);

          const secret = getJWTSecret(env);
          const newToken = await refreshJWT(token, secret);

          if (!newToken) {
            set.status = 401;
            return {
              ok: false,
              requestId,
              error: {
                code: 'INVALID_TOKEN',
                message: 'Token is invalid or expired',
              },
            };
          }

          return {
            ok: true,
            requestId,
            token: newToken,
            expiresIn: 3600, // 1 hour in seconds
          };
        } catch (error) {
          set.status = 400;
          return {
            ok: false,
            requestId,
            error: {
              code: 'VALIDATION_ERROR',
              message: toErrorMessage(error),
            },
          };
        }
      },
      {
        body: v.object({
          token: v.string(),
        }),
      },
    );

  return baseApp;
}
