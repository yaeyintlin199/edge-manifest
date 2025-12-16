import { sqliteTable, text, integer, real, blob } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const todolistTable = sqliteTable('todolist', {
  id: text('id').primaryKey().notNull(),
  title: text('title').notNull(),
  description: text('description'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

export const todoTable = sqliteTable('todo', {
  id: text('id').primaryKey().notNull(),
  listId: text('listId').notNull(),
  title: text('title').notNull(),
  done: integer('done').default(0),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

export type TodoList = typeof todolistTable.$inferSelect;
export type CreateTodoList = typeof todolistTable.$inferInsert;

export type Todo = typeof todoTable.$inferSelect;
export type CreateTodo = typeof todoTable.$inferInsert;