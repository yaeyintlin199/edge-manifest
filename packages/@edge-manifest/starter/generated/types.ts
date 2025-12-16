export interface TodoList {
  id?: string;
  title: string;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type CreateTodoListInput = Omit<TodoList, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateTodoListInput = Partial<CreateTodoListInput>;

export interface Todo {
  id?: string;
  listId: string;
  title: string;
  done?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type CreateTodoInput = Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateTodoInput = Partial<CreateTodoInput>;

export interface ListTodoListQuery {
  page?: number;
  limit?: number;
  sortBy?: 'id' | 'title' | 'description' | 'createdAt' | 'updatedAt';
  order?: 'asc' | 'desc';
}

export interface ListTodoQuery {
  page?: number;
  limit?: number;
  sortBy?: 'id' | 'listId' | 'title' | 'done' | 'createdAt' | 'updatedAt';
  order?: 'asc' | 'desc';
}

export interface ApiResponse<T> {
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
  error?: string;
}

export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}