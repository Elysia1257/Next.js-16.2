# API Reference

Base URL: http://localhost:8000 (dev) / production domain (prod)

## Auth

### POST /auth/register
Body: { "email": "...", "password": "..." }
Returns: { "access_token": "...", "refresh_token": "...", "user_id": "..." }

### POST /auth/login
Body: { "email": "...", "password": "..." }
Returns: { "access_token": "...", "refresh_token": "...", "user_id": "..." }

### POST /auth/refresh
Body: { "refresh_token": "..." }
Returns: { "access_token": "...", "refresh_token": "..." }

### GET /auth/me
Header: Authorization: Bearer {token}
Returns: { "user_id": "...", "email": "..." }

## Image Generation

### POST /generate/image (201)
Body: {
  "prompt": "string",
  "model": "viduq2" (default),
  "aspect_ratio": "16:9",
  "quality": "Standard",
  "resolution": "2K",
  "reference_images": ["url1", "url2"] (optional)
}
Returns: { "task_id": "string", "status": "running" }

Mode detection: reference_images present -> IMAGE_TO_IMAGE, else -> TEXT_TO_IMAGE.

## Video Generation

### POST /generate/video (201)
Body: {
  "prompt": "string",
  "model": "viduq3-turbo",
  "duration": 10,
  "aspect_ratio": "16:9",
  "resolution": "1080p",
  "audio_enabled": true,
  "vidu_mode": "text2video" | "img2video" | "reference2video" | "start_end2video",
  "start_frame_url": "string" (optional),
  "end_frame_url": "string" (optional),
  "reference_images": ["url"] (optional)
}
Returns: { "task_id": "string", "status": "running" }

## Task Polling

### GET /task/{task_id}
Returns: {
  "id": "string",
  "status": "success" | "failed" | "running" | "pending",
  "image_url": "string" | null,
  "video_url": "string" | null,
  "thumbnail_url": "string" | null,
  "error_message": "string" | null
}

## Image Upload

### POST /upload/image
FormData: { "file": File }
Returns: { "success": true, "filename": "string", "url": "string" }

## Workflows

### POST /workflows/
Body: { "name": "string", "project_id": "string" | null, "nodes_json": "string" | null, "edges_json": "string" | null }
Returns: WorkflowRow (id, owner_id, project_id, name, nodes_json, edges_json, created_at, updated_at)

### GET /workflows/
Returns: WorkflowRow[]

### GET /workflows/{id}
Returns: WorkflowRow

### PUT /workflows/{id}
Body: { "name"?: "string", "nodes_json"?: "string", "edges_json"?: "string" }
Returns: WorkflowRow

### DELETE /workflows/{id}
Returns: 204 No Content

## Provider Endpoints (Vidu)

These are called by the backend, not the frontend:

| TaskType | Vidu Endpoint |
|----------|--------------|
| TEXT_TO_VIDEO | POST /ent/v2/text2video |
| IMAGE_TO_VIDEO | POST /ent/v2/img2video |
| REFERENCE_TO_VIDEO | POST /ent/v2/reference2video |
| START_END_TO_VIDEO | POST /ent/v2/start-end2video |
| TEXT_TO_IMAGE | POST /ent/v2/text2image |
| IMAGE_TO_IMAGE | POST /ent/v2/reference2image |

Polling: GET /ent/v2/tasks/{task_id}/creations
