// TodoList API Endpoints
export interface GetTodoListRequest {
  id: string;
}

export interface GetTodoListResponse {
  data: TodoList;
}

export interface ListTodoListRequest extends ListTodoListQuery {}

export interface ListTodoListResponse {
  data: TodoList[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

export interface CreateTodoListRequest {
  data: CreateTodoListInput;
}

export interface CreateTodoListResponse {
  data: TodoList;
}

export interface UpdateTodoListRequest {
  id: string;
  data: UpdateTodoListInput;
}

export interface UpdateTodoListResponse {
  data: TodoList;
}

export interface DeleteTodoListRequest {
  id: string;
}

export interface DeleteTodoListResponse {
  data: { deleted: boolean };
}

// Todo API Endpoints
export interface GetTodoRequest {
  id: string;
}

export interface GetTodoResponse {
  data: Todo;
}

export interface ListTodoRequest extends ListTodoQuery {}

export interface ListTodoResponse {
  data: Todo[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

export interface CreateTodoRequest {
  data: CreateTodoInput;
}

export interface CreateTodoResponse {
  data: Todo;
}

export interface UpdateTodoRequest {
  id: string;
  data: UpdateTodoInput;
}

export interface UpdateTodoResponse {
  data: Todo;
}

export interface DeleteTodoRequest {
  id: string;
}

export interface DeleteTodoResponse {
  data: { deleted: boolean };
}