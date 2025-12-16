import { t } from 'elysia';

export const TodoListSchema = t.Object({
  id: t.Optional(t.String()),
  title: t.String(),
  description: t.Optional(t.String())
});

export const TodoSchema = t.Object({
  id: t.Optional(t.String()),
  listId: t.String(),
  title: t.String(),
  done: t.Optional(t.Boolean())
});