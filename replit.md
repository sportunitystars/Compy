# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Habit Tracker App

Full-stack Spanish habit tracking app. Features:
- Email/Password auth with JWT (stored in localStorage)
- Admin approval flow: new users → pending → admin approves → active
- Admin email: luisgomezm10@gmail.com (auto-gets admin + active status on register)
- Resend for email notifications
- Yearly calendar view per habit (12 months × days)
- 2–6 custom options per habit with custom colors
- Streak tracking (current + max, per month and all-time)
- Motivational alerts after 5 consecutive positive/negative days
- Admin panel to approve/reject users

## Required Secrets

- `RESEND_API_KEY` — from resend.com, for email notifications
- `JWT_SECRET` — any long random string for signing login tokens
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — optional, for Google OAuth (not yet implemented)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   └── habit-tracker/      # React + Vite frontend
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
│       └── src/schema/
│           ├── users.ts        # users table
│           ├── habits.ts       # habits table (with jsonb options)
│           └── habitLogs.ts    # habit_logs table
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

## API Routes

- `POST /api/auth/register` — register (auto-admin for luisgomezm10@gmail.com)
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/habits` — list user's habits
- `POST /api/habits` — create habit
- `GET /api/habits/:id` — get habit + all year logs
- `PATCH /api/habits/:id` — update habit
- `DELETE /api/habits/:id` — delete habit
- `PUT /api/habits/:id/logs/:date` — log/update a day (YYYY-MM-DD)
- `DELETE /api/habits/:id/logs/:date` — clear a day log
- `GET /api/admin/users` — list all users (admin only)
- `POST /api/admin/users/:id/approve` — approve user
- `POST /api/admin/users/:id/reject` — reject user

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- Always typecheck from the root: `pnpm run typecheck`
- `emitDeclarationOnly` — we only emit `.d.ts` files during typecheck
- Codegen: `pnpm --filter @workspace/api-spec run codegen`
- DB push: `pnpm --filter @workspace/db run push`
