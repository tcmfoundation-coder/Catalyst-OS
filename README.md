# Catalysts

Your personal academic operating system — a study partner that understands your
courses, semesters, grades, and (eventually) your habits, study sessions, and
learning history.

This is an early, real foundation, built one vertical slice at a time — not a
demo. See `AGENTS.md` for Next.js 16 conventions this codebase follows (it
diverges from older Next.js versions in a few places, e.g. `proxy.ts` instead
of `middleware.ts`).

## Stack

- Next.js 16 (App Router, TypeScript, Turbopack)
- MongoDB + Mongoose
- NextAuth v4 (Credentials provider, JWT sessions)
- Tailwind CSS
- Zod (validation)
- Vitest (unit tests)

## Getting started

1. Copy `.env.example` to `.env.local` and fill in the values:
   - `MONGODB_URI` — a running MongoDB instance
   - `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
   - `NEXTAUTH_URL` — `http://localhost:3000` for local development

2. Install dependencies and run the dev server:

   ```bash
   npm install
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build (also runs TypeScript checks)
- `npm run lint` — ESLint
- `npm test` — run the Vitest suite once
- `npm run test:watch` — Vitest in watch mode

## Current milestone (Phase 1)

- Email/password authentication with hashed passwords and JWT sessions.
- Academic years → semesters → courses, all owned per-user and enforced
  server-side (every query filters by the authenticated user's ID).
- A dedicated, unit-tested GPA/CGPA engine (`src/lib/academic/gpa.ts`) driven
  by a configurable grading scale (`src/lib/academic/grading-scale.ts`) —
  edit the scale to match your institution.
- A dashboard that reflects real data only: current academic period, current
  courses, semester GPA, and cumulative CGPA. No fabricated numbers.

Not built yet (by design — see the project's engineering principles): tasks,
study sessions, habits, learning memory, study materials/AI tutor, voice.
Those come after this foundation is solid.

## Project structure

```
src/
  app/                    # routes (App Router)
    dashboard/            # protected app shell + pages
    login/, register/     # auth pages
    api/auth/             # NextAuth handler + registration endpoint
  lib/
    academic/             # GPA engine + grading scale (pure, unit-tested)
    actions/              # Server Actions (ownership-checked mutations)
    auth.ts               # NextAuth config
    dal.ts                # session/auth data-access helpers
    db.ts                 # Mongoose connection
  models/                 # Mongoose schemas
  proxy.ts                # optimistic route-protection (Next.js 16's
                           # replacement for middleware.ts)
```
