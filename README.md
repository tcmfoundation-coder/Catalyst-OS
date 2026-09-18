# Catalysts

Your personal academic operating system — a study partner that understands your
courses, tasks, study time, habits, learning history, and study materials.

This is a real foundation, built one vertical slice at a time — not a demo.
See `AGENTS.md` for Next.js 16 conventions this codebase follows (it diverges
from older Next.js versions in a few places, e.g. `proxy.ts` instead of
`middleware.ts`).

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

Not built yet (by design — this is the foundation those features depend on):
streaming, quiz/flashcard generation, AI-generated study plans, voice.
Those come after this foundation is solid.

## Project structure

```
src/
  app/                    # routes (App Router)
    dashboard/            # protected app shell + pages, one folder per feature
    login/, register/     # auth pages
    api/auth/             # NextAuth handler + registration endpoint
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
                           # PromptBuilder, AIOrchestrator
    tutor/                 # AI Tutor: the first feature built on lib/ai —
                           # tutor-specific request/response shape + teaching
                           # instructions, calls AIOrchestrator only; plus
                           # persisted conversation CRUD, history bounding
                           # policy, and title derivation
    storage/s3.ts          # S3-compatible object storage client
    auth.ts, dal.ts, db.ts # NextAuth config, session helpers, Mongoose connection
  models/                 # Mongoose schemas
  proxy.ts                # optimistic route-protection (Next.js 16's
                           # replacement for middleware.ts)
processor/                # standalone Python document processor — see its
                           # own README for the extraction/chunking pipeline
```
