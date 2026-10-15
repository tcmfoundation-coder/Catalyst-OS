# Catalysts

Your personal academic operating system — a study partner that understands your
courses, tasks, study time, habits, learning history, and study materials.

This is a real foundation, built one vertical slice at a time — not a demo.
See `AGENTS.md` for Next.js 16 conventions this codebase follows (it diverges
from older Next.js versions in a few places, e.g. `proxy.ts` instead of
`middleware.ts`).

## Clients

The Android-first React Native app lives in `mobile/` and is the primary
client. The Next.js app remains the web companion and hosts Catalysts Core.
Both clients use the same MongoDB models and domain logic; mobile requests go
through the versioned `/api/mobile/v1/` routes rather than duplicating business
rules in the phone app. See `mobile/README.md` to configure a device-reachable
API URL and run Expo.

## Stack

- Next.js 16 (App Router, TypeScript, Turbopack)
- MongoDB + Mongoose
- NextAuth v4 (Credentials provider, JWT sessions)
- Tailwind CSS
- Zod (validation)
- Vitest (unit tests)
- S3-compatible object storage, for uploaded study material files
- Python (`processor/`) — a standalone document-processing component; see
  `processor/README.md`

## Getting started

1. Copy `.env.example` to `.env.local` and fill in the values. For local
   development the S3/processor defaults in `.env.example` work as-is once
   you start the local storage server (step 3).

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up the Python document processor and start local object storage
   (both are only needed for the Study Materials feature — see
   `processor/README.md` for details):

   ```bash
   cd processor && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt && cd ..
   npm run dev:storage   # in a separate terminal — local S3-compatible server, dev/test only
   ```

4. Run the dev server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000).

## Docker

The production container runs the Next.js web/API app and its Python document
processor. Docker Compose also starts MongoDB and keeps its data, the vector
index, and downloaded embedding models in named volumes.

1. Copy `.env.docker.example` to `.env.docker` and set unique,
   URL-safe `MONGO_INITDB_ROOT_PASSWORD` and `NEXTAUTH_SECRET` values. Add
   S3-compatible storage credentials to enable study material uploads, and an
   `ANTHROPIC_API_KEY` to enable AI responses.
2. Build and start the app:

   ```bash
   docker compose --env-file .env.docker up --build -d
   ```

3. Open [http://localhost:3000](http://localhost:3000). Stop the services with
   `docker compose down`; MongoDB and model/index data remain in their named
   volumes. Use `docker compose down -v` only when you intend to delete that
   persisted data.

The image is built for production, listens on port 3000, and runs as a
non-root user. The Expo mobile client is not included; it runs separately
using the instructions in `mobile/README.md`.

## Deploying on Render

Deploy the web/API as a Docker **Web Service** from the GitHub repository.
Choose the branch to deploy, select **Docker** as the runtime, and use the
root `Dockerfile`. Do not deploy `compose.yaml` on Render; it is for local
development and starts its own MongoDB service.

Set these service environment variables in the Render Dashboard:

| Variable | Value |
| --- | --- |
| `PORT` | `10000` |
| `NEXTAUTH_URL` | The public service URL, such as `https://catalysts-web.onrender.com` |
| `NEXTAUTH_SECRET` | A long, randomly generated secret |
| `MONGODB_URI` | The production MongoDB connection string, for example a MongoDB Atlas URI |
| `VECTOR_INDEX_DIR` | `/data/vector-index` |
| `EMBEDDING_MODEL_CACHE_DIR` | `/data/embedding-models` |
| `PROCESSOR_PYTHON_BIN` | `/opt/processor-venv/bin/python3` |

Set the Render **Health Check Path** to `/api/health`. It returns HTTP 200 only
when the app can connect to MongoDB and successfully ping it; database
connection failures are logged and return HTTP 503.

For MongoDB Atlas, configure Atlas network access to allow connections from
the Render service's outbound IP ranges (shown under the service's **Connect**
menu), or use a dedicated static outbound IP if your plan supports it. Ensure
reserved characters in the database username or password are URL-encoded in
`MONGODB_URI`.

Optional integrations:

- Set `S3_BUCKET`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY` to enable
  study-material file storage. `S3_REGION` defaults to `us-east-1`;
  `S3_ENDPOINT` is only needed for S3-compatible providers other than AWS, and
  `S3_FORCE_PATH_STYLE` defaults to `false`.
- Set `ANTHROPIC_API_KEY` to enable AI responses. `ANTHROPIC_MODEL` and
  `ANTHROPIC_EFFORT` are optional and default in the application.

Render's filesystem is ephemeral by default. If you want to retain the local
vector index and downloaded embedding models between deploys, attach a
persistent disk at `/data` (available on eligible paid plans). Without a disk,
those files may need to be recreated after a restart or deployment. MongoDB
data is stored in the external database, not on this disk.

## Scripts

- `npm run dev` — start the dev server
- `npm run dev:storage` — local S3-compatible storage server for development
  (never deploy this — see its section in `.gitignore`/`.env.example`)
- `npm run build` — production build (also runs TypeScript checks)
- `npm run lint` — ESLint
- `npm test` — run the Vitest suite once
- `npm run test:watch` — Vitest in watch mode

## What's built

- Authentication (email/password, hashed, JWT sessions), academic years →
  semesters → courses with a unit-tested GPA/CGPA engine
  (`src/lib/academic/`).
- Tasks, Study Sessions, Habits, and Learning Memories — all ownership-scoped
  CRUD, each with its own pure/unit-tested domain logic
  (`src/lib/tasks/`, `src/lib/study-sessions/`, `src/lib/habits/`,
  `src/lib/learning-memories/`).
- Study Materials: upload a PDF/DOCX/PPTX (direct-to-storage via a presigned
  URL), processed by the Python component in `processor/` into structured,
  ownership-scoped chunks (`StudyMaterial` + `MaterialChunk` models). See
  `processor/README.md` for the extraction/chunking pipeline itself.
- Embeddings & semantic retrieval: each chunk is embedded locally (no
  external API) via `processor/processor/embedding/` (fastembed,
  BAAI/bge-small-en-v1.5) and indexed in a persistent HNSW vector index
  (`src/lib/retrieval/`, `hnswlib-node`). `RetrievalService.search()` is
  the only way the app queries it — ownership-scoped, with MongoDB as the
  source of truth for both chunk content and the vectors themselves (the
  index is rebuildable from MongoDB, never the other way around).
- RAG & AI orchestration foundation (`src/lib/ai/`): `AIOrchestrator.ask()`
  (free-text) and `askStructured()` (schema-validated) coordinate
  RetrievalService, a deliberately-scoped `AcademicContextProvider`, a
  pure `ContextAssembler`, a `PromptBuilder` that enforces the trust
  boundary between application data and untrusted retrieved material, and
  an `LLMProvider` abstraction (Anthropic implementation) — see
  `src/lib/ai/orchestrator.ts` for the full flow.
- AI Tutor (`src/lib/tutor/`, `/dashboard/tutor`): ask a question,
  optionally scoped to a material or course, and get an answer grounded in
  your own uploaded study material with visible source attribution
  (material, page/slide, heading). No fabricated citations: sources always
  come from ContextAssembler's own retrieval output, never from the model.
- Persistent, multi-turn Tutor conversations (`TutorConversation` +
  `TutorMessage` models, `src/lib/tutor/conversations.ts`,
  `conversation-context.ts`, `conversation-policy.ts`): questions and
  answers are saved per conversation, with a two-pane UI (conversation list
  + active thread) at `/dashboard/tutor`. A follow-up's prompt includes a
  bounded window of recent history (message-count and character ceilings
  in one policy file) alongside — never instead of — the current question
  and any retrieved material; conversation history is deliberately never
  stored embeddings, retrieved chunk text, or full prompts, only messages
  and citation metadata. Every read/write re-verifies conversationId (and
  messageId) ownership server-side — a conversation ID from the browser is
  never trusted on its own.

- Structured learning resources & AI Study Notes (`src/lib/ai/resource-generation.ts`,
  `src/lib/study-resources/`, `/dashboard/study-notes`): a second AI-layer
  entry point, `generateStructuredResource()`, sitting alongside
  `ask()`/`askStructured()` in the RAG pipeline — for generators that need
  breadth across a whole material rather than the best match to one
  question. `RetrievalService.getMaterialCoverage()` returns a material's
  own chunks in document order (bounded by count/character budget, no
  vector search involved), and the generator refuses to call the LLM at
  all when a material has no usable content — unlike Tutor, there's no
  "general knowledge" fallback for a resource that's supposed to be
  grounded in the user's own document. The first resource type, Study
  Notes (title/overview/sections with key points, definitions, and
  examples), is Zod-validated end to end with explicit size limits
  (`lib/study-resources/notes-schema.ts`'s `NOTES_LIMITS`) so a model
  response can never balloon into an unbounded MongoDB document. Real
  sources are attached after generation from `ContextAssembler`'s own
  output — the model has no field to fabricate a citation into. Generated
  resources persist in one `StudyResource` model (discriminated by `type`,
  "notes" today) so future resource types (flashcards, quizzes) can reuse
  it without a schema migration.

Not built yet (by design — this is the foundation those features depend on):
streaming, flashcards, quizzes, AI-generated study plans, voice, adaptive
mastery, spaced repetition. Those come after this foundation is solid.

## Project structure

```
src/
  app/                    # routes (App Router)
    dashboard/            # protected app shell + pages, one folder per feature
    login/, register/     # auth pages
    api/auth/             # NextAuth handler + registration endpoint
    api/mobile/v1/        # mobile session and dashboard API
  lib/
    academic/             # GPA engine + grading scale (pure, unit-tested)
    tasks/, study-sessions/, habits/, learning-memories/, study-materials/
                           # per-feature domain logic (pure functions + zod
                           # validation), unit-tested independently of Mongo/Next
    actions/               # Server Actions (ownership-checked mutations)
    embeddings/, retrieval/ # local embedding provider + persistent HNSW
                           # index + RetrievalService (see their own comments)
    ai/                    # RAG/AI orchestration foundation: LLMProvider,
                           # AcademicContextProvider, ContextAssembler,
                           # PromptBuilder, AIOrchestrator, and
                           # resource-generation.ts (generateStructuredResource,
                           # the material-coverage sibling of askStructured)
    tutor/                 # AI Tutor: the first feature built on lib/ai —
                           # tutor-specific request/response shape + teaching
                           # instructions, calls AIOrchestrator only; plus
                           # persisted conversation CRUD, history bounding
                           # policy, and title derivation
    study-resources/       # Structured learning resources built on
                           # generateStructuredResource() — Study Notes'
                           # Zod schema + size-limit policy, role
                           # instructions, generation service (ownership,
                           # source attachment, persistence), and CRUD
    storage/s3.ts          # S3-compatible object storage client
    auth.ts, dal.ts, db.ts # NextAuth config, session helpers, Mongoose connection
  models/                 # Mongoose schemas
  proxy.ts                # optimistic route-protection (Next.js 16's
                           # replacement for middleware.ts)
mobile/                   # React Native + Expo Router client; separate TypeScript
                           # and ESLint configs; see its README and AGENTS.md
processor/                # standalone Python document processor — see its
                           # own README for the extraction/chunking pipeline
```
