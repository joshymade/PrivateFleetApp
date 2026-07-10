# Supabase Cloud + PrivateFleet env checklist

Primary path: **Supabase Cloud** (Auth + Postgres + RLS). Photos stay on **Cloudflare R2**. Do not commit `.env.local`.

Legacy self-hosted Docker notes (Kong / Coolify) live in [supabase-deploy-fix.md](supabase-deploy-fix.md) — optional only if you revive that stack.

---

## A) Supabase Dashboard (cloud project)

Project ref used by this repo: `mvrbfyoujggqazsicgal` → API URL `https://mvrbfyoujggqazsicgal.supabase.co`.

| Setting | Action |
| --- | --- |
| **API URL** | Project Settings → API → Project URL |
| **Publishable / anon key** | Copy into app `NEXT_PUBLIC_SUPABASE_ANON_KEY` (prefer `sb_publishable_…`) |
| **Service role / secret** | Copy into `SUPABASE_SERVICE_ROLE_KEY` (server-only; never `NEXT_PUBLIC_`) |
| **Auth redirect URLs** | Authentication → URL Configuration → add `http://localhost:3000/**` (and production origin when you deploy) |
| **Site URL** | Same screen — e.g. `http://localhost:3000` for local dev |
| **Email confirmations** | For local MVP, enable “Confirm email” off / autoconfirm, or configure SMTP |

Schema: apply repo migrations via Supabase MCP (`apply_migration`) or Dashboard → SQL Editor. Source of truth: `supabase/migrations/`.

### Where is user role?

App roles (`driver` | `safety` | `admin`) are on **`public.profiles.role`**, not on Authentication → Users (Auth has no role column).

| View / change | How |
| --- | --- |
| **Table Editor** | Dashboard → Table Editor → `profiles` → column **`role`** |
| **SQL Editor** (bootstrap first admin) | `update public.profiles set role = 'admin' where email = 'you@example.com';` — works when `auth.uid()` is null (Dashboard / service role); app RLS blocks non-admins |
| **App Admin UI** | Sign in as an **admin** → Profile → Manage users → `/admin/users` |

Signup always inserts `role = driver`. With zero admins, `/admin/users` redirects everyone away until someone is promoted via SQL/Table Editor.

---

## B) PrivateFleet app `.env.local`

Copy from `.env.local.example`, then fill:

| App variable | Set to |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key (or legacy anon JWT) |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret / service_role (server-only) |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` | Server-only — see [r2-setup.md](r2-setup.md) |
| `R2_PUBLIC_URL` | Public/CDN base (`*.r2.dev` or custom domain), not the S3 API host |
| `RESEND_API_KEY` | Server-only — Resend API key for driver Contact Admin emails |
| `RESEND_FROM_EMAIL` | Verified sender (e.g. `PrivateFleet <noreply@yourdomain.com>`); optional fallback `onboarding@resend.dev` for tests |

`DATABASE_URL` / `DIRECT_URL` are **optional** for the Next.js app. Use Dashboard connection strings only if you run `psql` / CLI migrations from your machine.

---

## C) After env is set — verify

1. `GET ${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health` with `apikey` header → **200**.
2. Confirm MVP tables exist: `profiles`, `loads`, `load_stops`, `load_trailer_history`, `damage_reports`, `damage_notices`, `safety_inbox_items`.
3. Restart `npm run dev` after changing `.env.local`.

---

## Quick order of operations

1. Create / open the Cloud project; copy URL + keys into `.env.local`.
2. Apply `001_init.sql` (MCP or SQL Editor) if tables are missing.
3. Configure Auth redirect URLs for localhost (and later production).
4. Keep R2 public URL as a CDN / `*.r2.dev` base (not the S3 API host).
5. Confirm R2 CORS allows browser PUT from `http://localhost:3000` (and production later) — [r2-setup.md](r2-setup.md) §6.
