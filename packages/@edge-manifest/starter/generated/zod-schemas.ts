import { z } from 'zod';

export const TodoListSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().optional()
});

export const CreateTodoListSchema = TodoListSchema.omit({ id: true, createdAt: true, updatedAt: true });

export const TodoSchema = z.object({
  id: z.string().uuid(),
  listId: z.string(),
  title: z.string(),
  done: z.boolean().optional()
});

export const CreateTodoSchema = TodoSchema.omit({ id: true, createdAt: true, updatedAt: true });