# API Testing Guide

This guide shows how to test the TODO app API with simple API key authentication.

## Setup

The worker automatically:
1. Loads the TODO manifest from `.dev.vars`
2. Creates database tables from the manifest
3. Registers CRUD routes for each entity

## Authentication

Use the API key from `.dev.vars`:
```bash
export API_KEY="dev-test-key-123"
```

Add it to requests as a header:
```bash
-H "x-api-key: $API_KEY"
```

## Health & Status Endpoints

### Check Health
```bash
curl http://127.0.0.1:7860/health | jq .
```

Response shows loaded manifest with entities:
```json
{
  "ok": true,
  "manifestLoaded": true,
  "manifest": {
    "id": "todo-app",
    "name": "Todo App",
    "entities": [
      {"name": "TodoList", "table": "todolist"},
      {"name": "Todo", "table": "todo"}
    ]
  }
}
```

### Check Database Ready
```bash
curl http://127.0.0.1:7860/ready | jq .
```

### Check Migrations Status
```bash
curl http://127.0.0.1:7860/migrations/status | jq .
```

Response shows which tables exist:
```json
{
  "ok": true,
  "tables": [
    {"name": "todolist", "exists": true},
    {"name": "todo", "exists": true}
  ]
}
```

## TodoList CRUD Operations

### Create a Todo List
```bash
curl -X POST http://127.0.0.1:7860/api/todolist \
  -H "x-api-key: dev-test-key-123" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "My First Todo List",
    "description": "Getting started with TODOs"
  }' | jq .
```

### List All Todo Lists
```bash
curl -H "x-api-key: dev-test-key-123" \
  "http://127.0.0.1:7860/api/todolist?limit=10&offset=0" | jq .
```

### Get a Specific Todo List
```bash
curl -H "x-api-key: dev-test-key-123" \
  "http://127.0.0.1:7860/api/todolist/550e8400-e29b-41d4-a716-446655440000" | jq .
```

### Update a Todo List
```bash
curl -X PATCH http://127.0.0.1:7860/api/todolist/550e8400-e29b-41d4-a716-446655440000 \
  -H "x-api-key: dev-test-key-123" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Title",
    "description": "New description"
  }' | jq .
```

### Delete a Todo List
```bash
curl -X DELETE http://127.0.0.1:7860/api/todolist/550e8400-e29b-41d4-a716-446655440000 \
  -H "x-api-key: dev-test-key-123" | jq .
```

## Todo (Tasks) CRUD Operations

### Create a Todo Item
```bash
curl -X POST http://127.0.0.1:7860/api/todo \
  -H "x-api-key: dev-test-key-123" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "listId": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Buy groceries",
    "completed": false,
    "dueDate": "2024-12-20T12:00:00Z"
  }' | jq .
```

### List Todos
```bash
curl -H "x-api-key: dev-test-key-123" \
  "http://127.0.0.1:7860/api/todo?limit=10" | jq .
```

### Mark Todo as Complete
```bash
curl -X PATCH http://127.0.0.1:7860/api/todo/660e8400-e29b-41d4-a716-446655440000 \
  -H "x-api-key: dev-test-key-123" \
  -H "Content-Type: application/json" \
  -d '{"completed": true}' | jq .
```

## Complete Test Script

```bash
#!/bin/bash
set -e

API_KEY="dev-test-key-123"
BASE_URL="http://127.0.0.1:7860"

echo "=== Testing Edge Manifest Worker ==="

echo "\n1. Health Check"
curl -s $BASE_URL/health | jq .

echo "\n2. Migrations Status"
curl -s $BASE_URL/migrations/status | jq .

echo "\n3. Create Todo List"
curl -s -X POST $BASE_URL/api/todolist \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Work Tasks",
    "description": "Tasks for this week"
  }' | jq .

echo "\n4. Create Todo Item"
curl -s -X POST $BASE_URL/api/todo \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "listId": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Review PRs",
    "completed": false
  }' | jq .

echo "\n5. List Todo Lists"
curl -s -H "x-api-key: $API_KEY" \
  "$BASE_URL/api/todolist" | jq .

echo "\n6. List Todos"
curl -s -H "x-api-key: $API_KEY" \
  "$BASE_URL/api/todo" | jq .

echo "\n=== All Tests Passed ==="
```

## Notes

- The API key is configured in `.dev.vars`
- For production, use proper JWT authentication via `/auth/login`
- Tables are auto-created from the manifest on first startup
- Timestamps (createdAt, updatedAt) are auto-generated
- The manifest can be changed in `.dev.vars` to add more entities
