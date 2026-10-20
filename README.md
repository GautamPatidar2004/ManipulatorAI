# CareerCompass AI

Production-minded AI Career Counsellor application built with **React + TypeScript + Vite + Tailwind CSS** frontend and **FastAPI + PostgreSQL + SQLAlchemy 2.x + Alembic** backend.

## Project Structure

```
├── .antigravity/            # Architecture intelligence tooling & code graph
├── backend/                 # Python + FastAPI backend service
│   ├── alembic/             # Alembic database migrations
│   │   ├── versions/        # Migration revisions (0001_initial_schema.py)
│   │   └── env.py           # Migration environment configuration
│   ├── app/
│   │   ├── api/
│   │   │   ├── routes/      # Endpoints (/health, /chat/conversations, /chat/messages, /chat/memory)
│   │   │   ├── schemas/     # Pydantic request/response schemas
│   │   │   └── router.py    # Route aggregator
│   │   ├── core/
│   │   │   ├── errors.py    # Standardized error handlers & models
│   │   │   └── logging.py   # Structured logging configuration
│   │   ├── db/
│   │   │   ├── base.py      # SQLAlchemy 2.x DeclarativeBase
│   │   │   └── session.py   # Connection pool, session lifecycle & db health probe
│   │   ├── models/          # ORM models (Conversation, Message, UserMemory)
│   │   ├── services/        # Transactional business logic (ChatService)
│   │   ├── config.py        # Pydantic Settings & environment config
│   │   └── main.py          # FastAPI application factory, lifespan & CORS
│   ├── tests/               # Pytest automated test suite
│   ├── requirements.txt     # Python dependencies
│   ├── .env.example         # Backend environment template
│   └── README.md
├── frontend/                # React 19 + TypeScript + Vite + Tailwind CSS
│   ├── src/
│   │   ├── api/             # Typed API client
│   │   ├── components/
│   │   │   ├── Chat/        # ChatContainer, MessageComposer, MessageItem, EmptyState, etc.
│   │   │   ├── Layout/      # Header, Sidebar, responsive mobile drawer
│   │   │   └── Common/      # StatusBadge, ErrorBanner
│   │   ├── hooks/           # useChat hook for state, persistence & networking
│   │   ├── types/           # Type definitions
│   │   ├── App.tsx          # Main layout view
│   │   └── index.css        # Tailwind CSS imports & base styles
│   ├── package.json
│   ├── .env.example         # Frontend environment template
│   └── README.md
├── .gitignore               # Root gitignore
└── README.md
```

## Quick Start

### 1. Database & Backend Setup (FastAPI + PostgreSQL)

1. Create PostgreSQL database:
   ```sql
   CREATE DATABASE careercompass;
   ```

2. Configure environment:
   ```bash
   cd backend
   copy .env.example .env
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Apply database migrations:
   ```bash
   alembic upgrade head
   ```

5. Run automated tests:
   ```bash
   pytest tests/test_api_and_db.py -v
   ```

6. Start backend service (port 8000):
   ```bash
   python -m uvicorn app.main:app --reload --port 8000
   ```

- Health Check & DB probe: `GET http://localhost:8000/api/v1/health`
- Interactive Swagger UI: `http://localhost:8000/docs`

### 2. Frontend Setup (React + Tailwind CSS)

```bash
cd frontend

# Install dependencies
npm install

# Start Vite dev server (port 5173)
npm run dev
```

Open `http://localhost:5173` in your browser.

## Current Milestone Status

- **PostgreSQL & SQLAlchemy 2.x Integration**: Configured connection pooling, session lifecycle, and transactional safety with rollback.
- **Alembic Migrations**: Fully valid revision `0001_initial_schema` creating `conversations`, `messages`, and `user_memories` with PostgreSQL indexes, cascading deletes, and JSONB variants.
- **Conversation & Message Persistence**: Validated CRUD endpoints for conversations, messages, and user memory foundation.
- **User Memory Foundation**: Structured table and API for storing stable user facts, sources, confidence, and monotonic version update tracking.
- **Chat UI Compatibility**: Frontend seamlessly persists messages, displays consultation history from the database, allows deleting sessions, and preserves light-theme Tailwind design.
