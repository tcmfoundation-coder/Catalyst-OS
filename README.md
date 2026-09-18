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

Not built yet (by design — this is the foundation those features depend on):
embeddings/vector search, RAG, AI-generated notes/flashcards/quizzes, an AI
tutor, voice. Those come after this foundation is solid.

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
    storage/s3.ts          # S3-compatible object storage client
    auth.ts, dal.ts, db.ts # NextAuth config, session helpers, Mongoose connection
  models/                 # Mongoose schemas
  proxy.ts                # optimistic route-protection (Next.js 16's
                           # replacement for middleware.ts)
processor/                # standalone Python document processor — see its
                           # own README for the extraction/chunking pipeline
```
