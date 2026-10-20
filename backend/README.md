# CareerCompass AI - Backend Service & PostgreSQL Foundation

FastAPI-powered backend foundation for the AI Career Counsellor platform, with PostgreSQL storage, SQLAlchemy 2.x ORM, and Alembic migrations.

## Architecture

- **Framework**: FastAPI with asynchronous/synchronous endpoints
- **Database ORM**: SQLAlchemy 2.x (`Mapped`, `mapped_column`, `selectin` relationships)
- **Database Driver**: `psycopg2-binary` (PostgreSQL)
- **Migrations**: Alembic with auto-managed revisions
- **Session Lifecycle**: Clean `get_db()` dependency with transactional rollbacks on error
- **Health & Diagnostics**: Active PostgreSQL connectivity probe (`SELECT 1`) on `GET /api/v1/health`

## Data Models

1. **`conversations`**:
   - `id` (VARCHAR(36), PK)
   - `title` (VARCHAR(255))
   - `created_at` (TIMESTAMP WITH TIME ZONE)
   - `updated_at` (TIMESTAMP WITH TIME ZONE)
   - Cascading relationship to messages
2. **`messages`**:
   - `id` (VARCHAR(36), PK)
   - `conversation_id` (VARCHAR(36), FK -> conversations.id ON DELETE CASCADE)
   - `role` (VARCHAR(20): user | assistant | system)
   - `content` (TEXT)
   - `status` (VARCHAR(30): ready | unavailable | error)
   - `notice` (TEXT, optional)
   - `structured` (JSONB / JSON, optional roadmap preview)
   - `created_at` (TIMESTAMP WITH TIME ZONE)
3. **`user_memories`** (User Memory Foundation):
   - `id` (VARCHAR(36), PK)
   - `user_id` (VARCHAR(64), index)
   - `key` (VARCHAR(128), semantic key e.g. target_role, skills)
   - `value` (TEXT)
   - `category` (VARCHAR(64): goals, skills, preferences, constraints)
   - `source` (VARCHAR(64): chat_dialogue, direct_input)
   - `confidence` (FLOAT: 0.0 - 1.0)
   - `version` (INTEGER: monotonic version for update tracking)
   - `is_active` (BOOLEAN: state tracking for active vs superseded facts)
   - `created_at` / `updated_at` (TIMESTAMP WITH TIME ZONE)

---

## PostgreSQL Setup & Database Migrations

### 1. PostgreSQL Prerequisites

Ensure PostgreSQL 14+ is running locally or via Docker:

```bash
# Example with Docker:
docker run --name careercompass-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=careercompass -p 5432:5432 -d postgres:16-alpine
```

Or in standard PostgreSQL (psql):
```sql
CREATE DATABASE careercompass;
```

### 2. Environment Configuration

Copy the example environment file:
```bash
copy .env.example .env
```

Configure your PostgreSQL credentials in `.env`:
```env
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="your_secure_password"
POSTGRES_HOST="localhost"
POSTGRES_PORT=5432
POSTGRES_DB="careercompass"
```

### 3. Run Alembic Migrations

To apply all migrations to your PostgreSQL database:
```bash
alembic upgrade head
```

To test offline migration generation (without a live database connection):
```bash
alembic upgrade head --sql
```

To roll back the last migration:
```bash
alembic downgrade -1
```

---

## API Endpoints

| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Health status and live PostgreSQL connectivity check |
| `POST` | `/api/v1/chat/message` | Processes message turn, stores both user and assistant turn in DB |
| `GET` | `/api/v1/chat/conversations` | Lists conversations with message counts |
| `POST` | `/api/v1/chat/conversations` | Creates a new conversation thread |
| `PATCH` | `/api/v1/chat/conversations/{id}` | Renames a conversation |
| `DELETE` | `/api/v1/chat/conversations/{id}` | Deletes a conversation and cascaded messages |
| `GET` | `/api/v1/chat/conversations/{id}/messages` | Retrieves all messages in a conversation |
| `POST` | `/api/v1/chat/conversations/{id}/messages` | Explicitly persists a message |
| `POST` | `/api/v1/chat/memory` | Stores or updates a verified user memory fact |
| `GET` | `/api/v1/chat/memory` | Lists verified user facts |

| `POST` | `/api/v1/auth/signup` | Register new user (strictly assigns `user` role) |
| `POST` | `/api/v1/auth/login` | Authenticate with email/password, returns JWT token |
| `GET` | `/api/v1/auth/me` | Fetch authenticated user profile & role |
| `POST` | `/api/v1/auth/logout` | Client logout endpoint |
| `GET` | `/api/v1/admin/stats` | Live platform telemetry (Admin only) |
| `GET` | `/api/v1/admin/users` | List registered accounts and roles (Admin only) |

---

## Authentication & Admin Provisioning

### 1. Environment Configuration
Ensure `.env` in `backend/` includes:
```env
JWT_SECRET_KEY=your-secure-jwt-secret
ACCESS_TOKEN_EXPIRE_MINUTES=1440
ALGORITHM=HS256
```

### 2. Provisioning the Initial Admin
Public signups are strictly locked to the `user` role. To securely provision an admin account without hardcoding credentials in git:
```bash
python -m app.cli.create_admin --email admin@careercompass.ai --password "SecureAdminPassword123" --name "Lead Administrator"
```
Or interactively without entering the password on the command line:
```bash
python -m app.cli.create_admin --email admin@careercompass.ai --name "Lead Administrator"
```

---

## User Management & Counsellor Escalations (Prompt 3)

The system provides complete administrator governance for registered users and human counsellor handoffs:
- **Strict Two-Role RBAC:** `admin` and `user`. Both students and parents operate under the standard `user` role.
- **User Account Roster:** Searchable, paginated user management (`GET /api/v1/admin/users`) with status/role filters.
- **User Audit View:** Inspect user profile, consultation threads, feedback ratings, and active facts count (`GET /api/v1/admin/users/{user_id}`).
- **Account Activation/Deactivation:** Secure status toggle with self-deactivation lockout protection (`PATCH /api/v1/admin/users/{user_id}/status`). No destructive deletion shortcuts.
- **Counsellor Escalation Workflow:** Complete lifecycle management with triage queue (`GET /api/v1/admin/escalations`), case detail (`GET /api/v1/admin/escalations/{case_id}`), and resolution update (`PATCH /api/v1/admin/escalations/{case_id}`).
- **Authorized Counsellor Assignment:** Cases can only be assigned to existing accounts with `role == 'admin'`, preventing fake or unauthorized counsellor assignment. Supported statuses: `pending`, `assigned`, `in_progress`, `resolved`.

---

## Running Automated Tests

Run the backend test suite using pytest:
```bash
pytest tests/ -v
```

---

## Running the Backend

```bash
python -m uvicorn app.main:app --reload --port 8000
```
Open Swagger Documentation at `http://localhost:8000/docs`.