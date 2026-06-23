# Architecture

## Overview

Cubex is a visual workflow platform for AI video and image generation. Users compose node-based pipelines on a canvas, connect image sources to generation nodes, and execute them against AI providers (Vidu, mock).

## System Diagram

\\\
+------------------+     HTTP/JSON      +-----------------+     HTTPS/JSON     +--------------+
|  Next.js 16.2    | <-----------------> |  FastAPI 0.110  | <-----------------> |  Vidu API    |
|  (Vercel)        |                     |  (Standalone)   |                     |  (api.vidu.cn)|
+------------------+                     +-----------------+                     +--------------+
        |                                        |
        | Supabase Storage API                   | SQLAlchemy
        v                                        v
+------------------+                     +-----------------+
|  Supabase        |                     |  PostgreSQL /   |
|  Storage (media) |                     |  SQLite (local) |
+------------------+                     +-----------------+
\\\

## Technology Stack

| Layer        | Technology               | Version      |
|------------- |--------------------------|------------- |
| Frontend     | Next.js (App Router)     | 16.2.9       |
| UI           | React + Tailwind CSS     | 19.2.4 / 4.x |
| Canvas       | @xyflow/react            | 12.11.0      |
| State        | Zustand                  | 5.0.14       |
| HTTP Client  | Axios                    | 1.18.0       |
| Auth (FE)    | Custom JWT helper        | —            |
| Storage (FE) | Supabase Storage REST    | —            |
| Backend      | FastAPI                  | 0.110+       |
| Server       | Uvicorn                  | 0.29+        |
| ORM          | SQLAlchemy               | 2.0+         |
| Migrations   | Alembic                  | 1.13+        |
| Auth (BE)    | python-jose + passlib    | 3.3+ / 1.7+  |
| Database     | PostgreSQL (prod) / SQLite (dev) | —    |
| AI Provider  | Vidu API (direct HTTP)   | —            |

## Directory Structure

\\\
/
├── app/                      # Next.js App Router pages
│   ├── page.tsx              # Main canvas page
│   ├── layout.tsx            # Root layout
│   └── globals.css           # Global styles
├── components/
│   ├── nodes/                # Flow node components
│   │   ├── ImageNode.tsx     # Text-to-Image / Image-to-Image
│   │   ├── ImageSourceNode.tsx  # Image upload source
│   │   ├── VideoNode.tsx     # Text-to-Video / Image-to-Video
│   │   └── StartEndVideoNode.tsx  # Start-End Frame Video
│   ├── ui/                   # Shared UI components
│   │   └── ModelSelector.tsx # Vidu model dropdown
│   ├── CubexCanvas.tsx       # xyflow canvas host
│   ├── CubexApp.tsx          # App shell
│   └── ContextMenu.tsx       # Right-click menu
├── hooks/                    # Custom React hooks
├── lib/                      # Frontend utilities
│   ├── api.ts                # Axios API client + generate/poll functions
│   ├── authHelper.ts         # JWT auto-auth (device-based dev mode)
│   ├── storage.ts            # Supabase Storage upload/delete
│   ├── supabase.ts           # Supabase client init
│   ├── workflowApi.ts        # Workflow CRUD through authFetch
│   └── nodeFactory.ts        # Node type registry
├── store/                    # Zustand stores
│   ├── canvasStore.ts        # Canvas state (nodes, edges, refs)
│   └── workflowStore.ts      # Workflow metadata
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app entry, router registration
│   │   ├── routes.py         # /generate/image, /generate/video, /task/{id}, /upload/image
│   │   ├── models.py         # SQLAlchemy models (User, Project, Workflow, Asset, Task)
│   │   ├── auth.py           # JWT creation, validation, get_current_user
│   │   ├── database.py       # SQLAlchemy engine + session
│   │   ├── executors/        # Node execution engine
│   │   │   ├── nodes/        # ImageNodeExecutor, etc.
│   │   │   ├── task_type.py  # TaskType enum (TEXT_TO_IMAGE, etc.)
│   │   │   └── workflow_executor.py
│   │   ├── providers/        # AI provider abstraction
│   │   │   ├── base.py       # BaseProvider ABC
│   │   │   ├── vidu_provider.py  # Vidu API integration
│   │   │   ├── mock_provider.py  # Mock for testing
│   │   │   └── provider_factory.py
│   │   └── routers/          # FastAPI routers
│   │       ├── auth.py       # /auth/register, /auth/login, /auth/refresh, /auth/me
│   │       ├── workflows.py  # Workflow CRUD
│   │       └── projects.py   # Project CRUD
│   ├── alembic/              # Database migrations
│   ├── requirements.txt      # Python dependencies
│   └── .env.example          # Environment variable template
├── package.json              # Frontend dependencies
├── vercel.json               # Vercel deployment config
└── tsconfig.json             # TypeScript config
\\\

## Data Flow

### Image Generation

\\\
ImageNode (FE)
  → generateImage()            # lib/api.ts
  → POST /generate/image       # routes.py
  → TaskType detect            # TEXT_TO_IMAGE | IMAGE_TO_IMAGE
  → ViduProvider.create_task() # vidu_provider.py
  → POST /ent/v2/text2image or /ent/v2/reference2image
  → return { task_id }
  
ImageNode polls
  → pollTaskResult(task_id)    # lib/api.ts
  → GET /task/{task_id}        # routes.py
  → ViduProvider.query_task()
  → GET /ent/v2/tasks/{id}/creations
  → return { status, image_url }
  
ImageNode renders <img src={image_url}>
\\\

### Video Generation

Same flow but uses generateVideo() → POST /generate/video → direct Vidu API calls in routes.py (not ViduProvider).

### Start-End Video

ImageSourceNode(s) → StartEndVideoNode connects via handles
  → startUrl / endUrl resolved from edges via useMemo
  → handleGenerate sends start_frame_url + end_frame_url
  → routes.py builds images: [start, end] payload
  → POST /ent/v2/start-end2video

## Authentication

- **Frontend**: Device-based auto-registration (uthHelper.ts). Creates a dev user with email dev_{deviceId}@cubex.local, obtains JWT, stores in localStorage.
- **Backend**: JWT issued by uth.py. Endpoints protected by get_current_user() FastAPI dependency.
- **Role**: No role system yet. All users are equal.

## Provider Pattern

The \BaseProvider\ ABC defines \create_task(params, task_type)\ and \query_task(provider_task_id)\. Concrete implementations:
- \ViduProvider\ — real Vidu API calls with endpoint routing via \TASK_ENDPOINTS\ dict
- \MockProvider\ — returns canned results for testing

The \provider_factory\ registry maps names to instances. Currently: \{"mock": MockProvider(), "vidu": ViduProvider()}\.

## Task Types (TaskType enum)

| Enum Value            | Vidu Endpoint                |
|---------------------- |----------------------------- |
| TEXT_TO_VIDEO         | /ent/v2/text2video           |
| IMAGE_TO_VIDEO        | /ent/v2/img2video            |
| REFERENCE_TO_VIDEO    | /ent/v2/reference2video      |
| START_END_TO_VIDEO    | /ent/v2/start-end2video      |
| TEXT_TO_IMAGE         | /ent/v2/text2image           |
| IMAGE_TO_IMAGE        | /ent/v2/reference2image      |
