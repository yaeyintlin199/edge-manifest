import type { ConfigParserResult } from '@edge-manifest/core';
import type { Elysia } from 'elysia';
import * as v from 'valibot';
import { CrudService, errorResponse, listResponse, successResponse } from './crud';
import { generateValidatorsForEntity } from './validators';

/**
 * Auth guard: checks if user is authenticated
 */
function requireAuth(user: Record<string, unknown> | null, set: any): boolean {
  if (!user) {
    set.status = 401;
    return false;
  }
  return true;
}

/**
 * Registers CRUD routes for all entities in the manifest
 */
export async function registerCrudRoutes(app: Elysia<any>, manifest: ConfigParserResult): Promise<Elysia<any>> {
  for (const entity of manifest.entities) {
    const crud = new CrudService(entity.name);
    const validators = generateValidatorsForEntity(entity);
    const entityPath = `/api/${entity.name.toLowerCase()}`;

    // List endpoint: GET /api/<entity>?limit=10&offset=0
    app.get(entityPath, async (ctx: any): Promise<any> => {
      const { db, request, set, user } = ctx;
      if (!requireAuth(user, set)) {
        return errorResponse('UNAUTHORIZED', 'Authentication required');
      }

      if (!db) {
        set.status = 503;
        return errorResponse('DB_UNAVAILABLE', 'Database connection unavailable');
      }

      try {
        const url = new URL(request.url);
        const query = {
          limit: url.searchParams.get('limit') ? Number.parseInt(url.searchParams.get('limit')!, 10) : 10,
          offset: url.searchParams.get('offset') ? Number.parseInt(url.searchParams.get('offset')!, 10) : 0,
          sort: url.searchParams.get('sort'),
          filter: url.searchParams.get('filter'),
        };

        const { items, total } = await crud.list(db, {
          limit: query.limit,
          offset: query.offset,
          sort: query.sort || undefined,
          filter: query.filter || undefined,
        });

        return listResponse(items, total, query.limit, query.offset);
      } catch (error) {
        set.status = 500;
        const message = error instanceof Error ? error.message : 'Failed to list entities';
        return errorResponse('DATABASE_ERROR', message);
      }
    });

    // Get endpoint: GET /api/<entity>/:id
    app.get(`${entityPath}/:id`, async (ctx: any): Promise<any> => {
      const { db, params, set, user } = ctx;
      if (!requireAuth(user, set)) {
        return errorResponse('UNAUTHORIZED', 'Authentication required');
      }

      if (!db) {
        set.status = 503;
        return errorResponse('DB_UNAVAILABLE', 'Database connection unavailable');
      }

      try {
        const item = await crud.get(db, params.id);
        if (!item) {
          set.status = 404;
          return errorResponse('NOT_FOUND', `Entity not found with id: ${params.id}`);
        }
        return successResponse(item);
      } catch (error) {
        set.status = 500;
        const message = error instanceof Error ? error.message : 'Failed to fetch entity';
        return errorResponse('DATABASE_ERROR', message);
      }
    });

    // Create endpoint: POST /api/<entity>
    app.post(entityPath, async (ctx: any): Promise<any> => {
      const { db, body, set, user } = ctx;
      if (!requireAuth(user, set)) {
        return errorResponse('UNAUTHORIZED', 'Authentication required');
      }

      if (!db) {
        set.status = 503;
        return errorResponse('DB_UNAVAILABLE', 'Database connection unavailable');
      }

      try {
        // Use body directly from context (Elysia handles parsing)
        const bodyData = body || {};

        // Validate
        const parsed = await v.parseAsync(validators.createBody, bodyData);

        const item = await crud.create(db, parsed as any);
        set.status = 201;
        return successResponse(item);
      } catch (error) {
        set.status = 400;
        const message = error instanceof Error ? error.message : 'Validation or creation failed';
        return errorResponse('VALIDATION_ERROR', message);
      }
    });

    // Update endpoint: PUT/PATCH /api/<entity>/:id
    const updateHandler = async ({ db, params, body, set, user }: any): Promise<any> => {
      if (!requireAuth(user, set)) {
        return errorResponse('UNAUTHORIZED', 'Authentication required');
      }

      if (!db) {
        set.status = 503;
        return errorResponse('DB_UNAVAILABLE', 'Database connection unavailable');
      }

      try {
        const bodyData = body || {};

        const parsed = await v.parseAsync(validators.updateBody, bodyData);

        const item = await crud.update(db, params.id, parsed as any);
        if (!item) {
          set.status = 404;
          return errorResponse('NOT_FOUND', `Entity not found with id: ${params.id}`);
        }
        return successResponse(item);
      } catch (error) {
        set.status = 400;
        const message = error instanceof Error ? error.message : 'Validation or update failed';
        return errorResponse('VALIDATION_ERROR', message);
      }
    };

    app.put(`${entityPath}/:id`, updateHandler);
    app.patch(`${entityPath}/:id`, updateHandler);

    // Delete endpoint: DELETE /api/<entity>/:id
    app.delete(`${entityPath}/:id`, async (ctx: any): Promise<any> => {
      const { db, params, set, user } = ctx;
      if (!requireAuth(user, set)) {
        return errorResponse('UNAUTHORIZED', 'Authentication required');
      }

      if (!db) {
        set.status = 503;
        return errorResponse('DB_UNAVAILABLE', 'Database connection unavailable');
      }

      try {
        const deleted = await crud.delete(db, params.id);
        if (!deleted) {
          set.status = 404;
          return errorResponse('NOT_FOUND', `Entity not found with id: ${params.id}`);
        }
        return successResponse({ id: params.id });
      } catch (error) {
        set.status = 500;
        const message = error instanceof Error ? error.message : 'Deletion failed';
        return errorResponse('DATABASE_ERROR', message);
      }
    });
  }

  return app;
}
