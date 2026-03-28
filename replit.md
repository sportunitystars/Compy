# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: Supabase (PostgreSQL) — queried via `@supabase/supabase-js` admin client
- **Auth**: Supabase Auth (email/password + Google OAuth)
- **API codegen**: Orval (from OpenAPI spec at `lib/api-spec/openapi.yaml`)
- **Build**: esbuild

## Habit Tracker App

Full-stack Spanish habit tracking app. Features:
- Email/Password auth (via Supabase Auth)
- Google OAuth (via Supabase Auth — configure in Supabase dashboard)
- Admin approval flow: new users → pending → admin approves via panel → email sent → active
- Admin email: `luisgomezm10@gmail.com` (auto-gets admin + active status on register)
- Gmail SMTP (nodemailer) for email notifications (new user notification to admin, approval/rejection email to user)
- Yearly calendar view per habit (Jan–Dec, current year)
- 2–6 custom options per habit with custom colors (isPositive / isNegative flags)
- Streak tracking (current + max, per month and all-time)
- Motivational alerts after 5 consecutive positive/negative days
- Admin panel to approve/reject/delete users

## Required Secrets

- `SUPABASE_URL` — Supabase Project URL (`https://msssbdjotmcebowmqwfl.supabase.co`)
- `SUPABASE_ANON_KEY` — Supabase anon/public key (used in frontend)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service_role key (used in backend, bypasses RLS)
- `SUPABASE_DB_URL` — Direct PostgreSQL connection string
- `GMAIL_USER` — Gmail address for sending emails (luisgomezm10@gmail.com)
- `GMAIL_APP_PASSWORD` — Gmail App Password for nodemailer SMTP
- `JWT_SECRET` — legacy (kept for compatibility)
- `RESEND_API_KEY` — unused (replaced by Gmail SMTP)

## Database Tables (in Supabase) — ACTUAL column names

- `profiles` — `id` (uuid), `email`, `name`, `status` (pending/active/rejected), `role` (user/admin), `created_at`
- `habits` — `id` (uuid), `user_id` (uuid), `name`, `description` (stores emoji!), `options` (jsonb), `created_at`
  - NOTE: DB uses `description` column, API maps it to/from `emoji` field
- `habit_logs` — `id` (uuid), `habit_id` (uuid), `date` (YYYY-MM-DD), `value` (stores optionIndex as string!), `note`, `created_at`
  - NOTE: DB uses `value` column, API maps it to/from `optionIndex` field; NO `user_id` column

## ID Types

All IDs (users, habits, logs) are UUIDs (string). The OpenAPI spec and generated client use `string` type for all IDs. Never use `parseInt()` on habit or user IDs.

## Structure

```text
/
├── artifacts/
│   ├── api-server/         # Express API server (Supabase admin client)
│   │   └── src/
│   │       ├── lib/
│   │       │   ├── supabase.ts  # Supabase admin client
│   │       │   ├── auth.ts      # Supabase JWT middleware
│   │       │   └── email.ts     # Resend email helpers
│   │       └── routes/
│   │           ├── auth.ts      # register, login, /me
│   │           ├── habits.ts    # CRUD habits + logs
│   │           └── admin.ts     # list/approve/reject users
│   └── habit-tracker/      # React + Vite frontend
│       └── src/
│           ├── lib/
│           │   ├── supabase.ts    # Supabase anon client (frontend)
│           │   └── query-client.ts # Shared React Query client
│           ├── hooks/
│           │   └── use-auth.tsx  # Auth state via Supabase session
│           └── pages/
│               ├── login.tsx     # Email + Google login
│               ├── register.tsx  # Email + Google register
│               ├── auth-callback.tsx # OAuth redirect handler
│               ├── dashboard.tsx
│               ├── habit-detail.tsx
│               ├── create-habit.tsx
│               ├── admin.tsx     # Admin panel
│               └── pending.tsx   # Pending/rejected screen
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   └── api-zod/            # Generated Zod schemas from OpenAPI
└── scripts/
    └── src/setup-supabase.ts  # Checks Supabase connection & tables
```

## API Routes

- `POST /api/auth/register` — create account (profile created server-side, admin email notified)
- `POST /api/auth/login` — login with email/password via Supabase
- `GET /api/auth/me` — get/create profile for current Supabase user
- `POST /api/auth/logout`
- `GET /api/habits`
- `POST /api/habits`
- `GET /api/habits/:id` — habit + current year logs
- `PATCH /api/habits/:id`
- `DELETE /api/habits/:id`
- `PUT /api/habits/:id/logs/:date`
- `DELETE /api/habits/:id/logs/:date`
- `GET /api/admin/users` — list all profiles (admin only)
- `POST /api/admin/users/:id/approve` — set status=active + send approval email
- `POST /api/admin/users/:id/reject` — set status=rejected

## Auth Flow

1. User registers (email or Google) → profile created with `status: "pending"`
2. Admin gets notified by email (Resend)
3. Admin opens `/admin` panel, sees pending users, clicks Aprobar/Rechazar
4. On approval → profile `status: "active"` + user gets email via Resend
5. User can now access the full app

## Codegen

```bash
pnpm --filter @workspace/api-spec run codegen
```

## Check Supabase Connection

```bash
pnpm --filter @workspace/scripts run setup-supabase
```
