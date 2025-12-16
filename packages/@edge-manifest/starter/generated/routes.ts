import { Elysia, t } from 'elysia';
import { eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './schema';

export const todolistRouter = new Elysia({ prefix: '/todolists' })
  .get('/', async ({ query, store }: any) => {
    const db = store.db as DrizzleD1Database;
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const offset = (page - 1) * limit;

    const items = await db.select().from(schema.todolistTable).limit(limit).offset(offset).all();
    const [{ count }] = await db.select({ count: sql`count(*)` }).from(schema.todolistTable).all();

    return {
      data: items,
      meta: {
        total: count,
        page,
        limit,
      },
    };
  })
  .post('/', async ({ body, store }: any) => {
    const db = store.db as DrizzleD1Database;
    const id = crypto.randomUUID();
    
    const [item] = await db.insert(schema.todolistTable)
      .values({ id, ...body })
      .returning()
      .all();

    return { data: item };
  }, {
    body: t.Object({
      title: t.String(),
      description: t.Optional(t.String())
    })
  })
  .get('/:id', async ({ params, store }: any) => {
    const db = store.db as DrizzleD1Database;
    
    const [item] = await db.select()
      .from(schema.todolistTable)
      .where(eq(schema.todolistTable.id, params.id))
      .all();

    if (!item) {
      throw new Error('Not found');
    }

    return { data: item };
  })
  .patch('/:id', async ({ params, body, store }: any) => {
    const db = store.db as DrizzleD1Database;
    
    const [item] = await db.update(schema.todolistTable)
      .set({ ...body, updatedAt: new Date().toISOString() })
      .where(eq(schema.todolistTable.id, params.id))
      .returning()
      .all();

    if (!item) {
      throw new Error('Not found');
    }

    return { data: item };
  }, {
    body: t.Partial(t.Object({
      title: t.Optional(t.String()),
      description: t.Optional(t.String())
    }))
  })
  .delete('/:id', async ({ params, store }: any) => {
    const db = store.db as DrizzleD1Database;
    
    await db.delete(schema.todolistTable)
      .where(eq(schema.todolistTable.id, params.id))
      .run();

    return { data: { deleted: true } };
  });

export const todoRouter = new Elysia({ prefix: '/todos' })
  .get('/', async ({ query, store }: any) => {
    const db = store.db as DrizzleD1Database;
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const offset = (page - 1) * limit;

    const items = await db.select().from(schema.todoTable).limit(limit).offset(offset).all();
    const [{ count }] = await db.select({ count: sql`count(*)` }).from(schema.todoTable).all();

    return {
      data: items,
      meta: {
        total: count,
        page,
        limit,
      },
    };
  })
  .post('/', async ({ body, store }: any) => {
    const db = store.db as DrizzleD1Database;
    const id = crypto.randomUUID();
    
    const [item] = await db.insert(schema.todoTable)
      .values({ id, ...body })
      .returning()
      .all();

    return { data: item };
  }, {
    body: t.Object({
      listId: t.String(),
      title: t.String(),
      done: t.Optional(t.Boolean())
    })
  })
  .get('/:id', async ({ params, store }: any) => {
    const db = store.db as DrizzleD1Database;
    
    const [item] = await db.select()
      .from(schema.todoTable)
      .where(eq(schema.todoTable.id, params.id))
      .all();

    if (!item) {
      throw new Error('Not found');
    }

    return { data: item };
  })
  .patch('/:id', async ({ params, body, store }: any) => {
    const db = store.db as DrizzleD1Database;
    
    const [item] = await db.update(schema.todoTable)
      .set({ ...body, updatedAt: new Date().toISOString() })
      .where(eq(schema.todoTable.id, params.id))
      .returning()
      .all();

    if (!item) {
      throw new Error('Not found');
    }

    return { data: item };
  }, {
    body: t.Partial(t.Object({
      listId: t.Optional(t.String()),
      title: t.Optional(t.String()),
      done: t.Optional(t.Boolean())
    }))
  })
  .delete('/:id', async ({ params, store }: any) => {
    const db = store.db as DrizzleD1Database;
    
    await db.delete(schema.todoTable)
      .where(eq(schema.todoTable.id, params.id))
      .run();

    return { data: { deleted: true } };
  });

export function createApiRouter() {
  return new Elysia({ prefix: '/api' })
    .use(todolistRouter)
    .use(todoRouter);
}