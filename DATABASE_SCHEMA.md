# Database Schema

## Engine
Production: Supabase PostgreSQL via DATABASE_URL. Development: SQLite (backend/app.db).

## Tables

### users
| Column | Type | Constraints |
|--------|------|-------------|
| id | VARCHAR(32) | PK, uuid4 |
| email | VARCHAR(255) | UNIQUE, NOT NULL |
| password_hash | VARCHAR(255) | NOT NULL (bcrypt) |
| display_name | VARCHAR(100) | NULLABLE |
| created_at | TIMESTAMPTZ | now() |
| updated_at | TIMESTAMPTZ | now() |

No role/owner_id yet. All users equal.

### projects
| Column | Type | Constraints |
|--------|------|-------------|
| id | VARCHAR(32) | PK, uuid4 |
| owner_id | VARCHAR(32) | FK->users |
| name | VARCHAR(255) | NOT NULL |
| created_at | TIMESTAMPTZ | now() |

### workflows
| Column | Type | Constraints |
|--------|------|-------------|
| id | VARCHAR(32) | PK, uuid4 |
| owner_id | VARCHAR(32) | FK->users |
| project_id | VARCHAR(32) | FK->projects (nullable) |
| name | VARCHAR(255) | NOT NULL |
| nodes_json | TEXT | null |
| edges_json | TEXT | null |
| created_at | TIMESTAMPTZ | now() |
| updated_at | TIMESTAMPTZ | onupdate |

### assets
| Column | Type | Constraints |
|--------|------|-------------|
| id | VARCHAR(32) | PK, uuid4 |
| owner_id | VARCHAR(32) | FK->users |
| workflow_id | VARCHAR(32) | FK->workflows (nullable) |
| filename | VARCHAR(255) | NOT NULL |
| storage_url | VARCHAR(512) | NOT NULL |
| mime_type | VARCHAR(100) | null |
| created_at | TIMESTAMPTZ | now() |

### tasks (legacy)
id, workflow_id (FK), status, result, created_at.
Not used by current per-node generation.

## Planned (Owner/Member)
credits, credit_logs, invite_codes, api_keys, task_usage tables not yet created.
