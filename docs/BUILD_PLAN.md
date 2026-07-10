# PrivateFleet — Build Plan

**Canonical product plan.** Use this for what we are building. Day-to-day infra/checklist lives in [TASKS.md](../TASKS.md). Supabase/R2 setup notes: [supabase-env-checklist.md](supabase-env-checklist.md), [r2-setup.md](r2-setup.md).

Infra primary path is **Supabase Cloud** (Auth + Postgres + RLS) with photos on **Cloudflare R2**. Schema lives in `supabase/migrations/`; apply via hosted Supabase MCP or Dashboard SQL. See [TASKS.md](../TASKS.md) and [supabase-env-checklist.md](supabase-env-checklist.md).

---

## Product vision

PrivateFleet is a mobile-first PWA for a private truck fleet. Drivers work from a **5-tab bottom nav**: Home (today’s load), Loads (history), Feed (damage reports + notice/comments), Report (tractor / trailer damage), and Profile (details + notifications). Safety and Admin share overlapping surfaces (especially Feed) with extra oversight tools; Admins also manage users/roles.

Photos live in **Cloudflare R2**; Postgres (Supabase) stores metadata, notices (“viewed” / “notice”), comments, referrals, loads, and notification state. Scaffold already exists: auth/app route groups, `001_init.sql`, R2/presign stubs, PWA wiring.

---

## Roles & permissions matrix

| Capability | Driver | Safety | Admin |
| --- | --- | --- | --- |
| Sign up / sign in | Yes (unique **Driver ID** required) | Yes (account provisioned; no Driver ID UX required unless reused as employee id) | Yes |
| **Home** — current-day load card | Yes (own load) | Ops summary / inbox shortcuts OK; not primary load logging | Same as Safety + fleet oversight shortcuts |
| Log / update own loads | Yes (Home quick-add + Loads) | No | Oversight: view all; may create/assign as needed for MVP |
| Change trailer on current load | Yes (Home) | No | Optional oversight |
| Browse **Loads** history | Own loads | No | Fleet loads |
| **Feed** — latest damage reports | Yes (fleet feed as allowed by RLS) | Yes — primary review surface | Full visibility |
| **Notice** a damage report | Yes (on Feed detail) | Yes | Yes |
| Comment on a damage report | Yes | Yes | Yes |
| **Report** — upload tractor / trailer damage | Yes (two entry cards) | No | No (view only unless acting as driver later) |
| Send own damage image **to Safety** | Yes → Safety inbox | Receive only | Can see inbox / triage if useful |
| Safety **inbox** (referrals) | Send only | Yes — reachable from Home / Profile / Feed filters | Full visibility |
| **Profile** — driver details + notifications | Yes (own) | Own profile + Safety-oriented settings / inbox entry | Own + **Admin users** entry |
| Manage users & roles | No | No | Yes |
| Assign / oversee loads fleet-wide | Own loads | No | Yes |

**Notice language:** UI says **Notice** (or “Noticed”). Storage maps to existing `damage_notices` (legacy “noticed” / product “viewed”). Never duplicate photos for a notice. RLS: any authenticated user can insert/delete **own** notice (`003_notice_rls_drivers.sql`; mirrored in `001_init.sql` for greenfield).

**MVP-scoped Admin (do not invent exotic tooling):**

- List users / profiles
- Set role: `driver` | `safety` | `admin`
- Full read of loads, damage (trailer + tractor), Feed, comments, inbox, notices
- Basic loads oversight (view all; create/assign if needed for ops)
- Entry from Profile (or Admin-only overlay), not a 6th bottom tab

---

## Driver shell — 5-tab bottom nav

Primary MVP chrome for **Drivers**. Touch-friendly, `max-w-lg`, fixed bottom bar in `(app)/layout`. Five equal tabs:

| Tab | Purpose | Primary route |
| --- | --- | --- |
| **1. Home** | Today’s work surface | `(app)/home` (replaces / supersedes dashboard-as-home) |
| **2. Loads** | Load history by month / week | `(app)/loads` |
| **3. Feed** | Latest damage reports; Notice + comments | `(app)/feed` |
| **4. Report** | Start tractor or trailer damage report | `(app)/report` |
| **5. Profile** | Driver details + notifications | `(app)/profile` |

### 1. Home

- **Current day-of-week card** — e.g. “Thursday” / date as the hero of the screen.
- **Current load details** on that card (load #, trailer, route/stops summary, status, miles as available). Empty state when no active load for today.
- **Quick add load** — prominent control → create-load flow (inline sheet or `(app)/loads/new`).
- **Change trailer** — swaps trailer on the current/active load; writes `load_trailer_history` (already in schema).

### 2. Loads

- **Current month:** past loads as **cards** (scanable: date, load #, trailer, route snippet, status).
- **Older than current month:** compact **list** rows (not cards).
- Tap any row/card → load detail (any month / week). Support browsing other months/weeks (month picker, week sections, or infinite chronologic scroll with sticky month headers — pick one mobile-friendly pattern at implement time).
- Create / edit load from here as well as Home quick-add.

### 3. Feed

- Chronologic (newest first) stream of **damage reports** (trailer + tractor), metadata + thumbnail.
- Open item → photo, GPS/time/asset/driver snapshots.
- Actions on detail (and optionally inline):
  - **Notice** → insert `damage_notices` for current user; show Noticed state (count / who noticed as needed).
  - **Comment** → new comment thread on the report (schema required; see Data model).
- Drivers can still **Send to Safety** from their own report detail (referral ≠ Notice).
- Safety’s day-to-day review is this same Feed (plus inbox for explicit referrals).

### 4. Report

- Hub with **two large cards**:
  - **Tractor** → capture flow (`asset_type = tractor`)
  - **Trailer** → capture flow (`asset_type = trailer`)
- Shared pipeline: camera / file → GPS → presign → R2 → `damage_reports` row.
- After capture, land on report detail (optional nudge: Send to Safety). Export (canvas composite) remains available from detail / tools, not a bottom-nav tab.

### 5. Profile

- **Driver details:** Driver ID, name, email, role badge (read-mostly; edit name if product allows).
- **Notifications:** in-app list (and badge on tab when unread) — e.g. comments on your reports, notices on your uploads, Safety inbox acknowledgements, load assignments. **New product surface** (not in `001_init.sql` yet).
- Safety/Admin: same Profile plus links to inbox / admin users as role allows.
- Sign out.

---

## Safety & Admin navigation (overlays on the same shell)

Do **not** invent a separate app. Role-aware bottom nav and destinations:

| Tab | Safety | Admin |
| --- | --- | --- |
| **Home** | Inbox-forward home: pending referrals count, shortcuts into Feed / inbox | Same + fleet ops shortcuts (loads overview, users) |
| **Loads** | Hidden or read-only fleet list if useful; default **hide** for Safety | Fleet loads (cards/list same pattern, all drivers) |
| **Feed** | Primary — browse all damage; Notice + comments | Full Feed |
| **Report** | **Hidden** (no upload) | **Hidden** (no upload) |
| **Profile** | Details + notifications + **Safety inbox** entry | Details + notifications + **Admin users** (+ inbox) |

**Safety inbox** remains a first-class route (`(app)/safety/inbox`): list referrals → open photo/metadata → Notice; acknowledge referral status. Prefer linking from Home/Profile rather than a dedicated bottom tab so Driver’s five tabs stay clean.

**Admin users** (`(app)/admin/users`): list profiles, set `driver` | `safety` | `admin`. Reach from Profile.

---

## Core flows

### Auth / signup

- Email + password via Supabase Auth.
- **Drivers** must provide a unique company **Driver ID** at signup; pass `driver_id` (and optional `full_name`) in auth user metadata so `handle_new_user` fills `profiles` (existing trigger in `001_init.sql`).
- Assign default role `driver` on create; Admin (or seed) sets `safety` / `admin`.
- Protect `(app)` routes; middleware keeps session refresh; redirect into role-appropriate Home.

### Loads

- Drivers log loads (number, trailer, route, stops, miles, status) from **Home** quick-add and **Loads**.
- Trailer swap on a load → `load_trailer_history`.
- Admin sees fleet loads; may assign drivers.

### Damage report (tractor + trailer)

- **Report** tab → tractor or trailer card → capture. UI may say “truck”; schema uses `asset_type = 'tractor'` (no separate truck table).
- Same photo pipeline; `damage_reports.asset_type` + `asset_number`.
- **Report comment** = `damage_reports.report_comment` — multi-line description from the uploading driver (trailer and tractor). Not a Feed reply.
- Search/browse of historical damage is primarily **Feed** (retire dedicated Search as a bottom-nav item; optional search/filter on Feed).

### Feed: Notice + comments

- **Notice** = `damage_notices` row for (report, user). Product copy: Notice / Noticed. Prefer extending existing table over duplicating “viewed” columns in MVP.
- **Feed replies** = `damage_report_comments` (damage_report_id, author_id, body, created_at) + RLS (authenticated fleet read; insert/update own; delete own or Admin). Distinct from `report_comment`.
- Notice ≠ Send to Safety ≠ report comment ≠ Feed reply.

### Send to Safety

- Driver opens **their** report (from Feed or post-capture) → **Send to Safety**.
- Creates `safety_inbox_items` referral (no photo re-upload); Safety sees it in inbox.

### Safety inbox

- List of referrals (pending / acknowledged as needed).
- Open item → view photo + metadata; can **Notice**; update referral status.

### Admin

- Users & roles management screen.
- Fleet-wide visibility into loads, Feed, inbox, notices, comments.

---

## Information architecture / routes

Reflects target driver IA; map legacy scaffold routes during implementation.

| Area | Route(s) | Notes |
| --- | --- | --- |
| Landing | `src/app/page.tsx` | Redirect by session/role → `/home` |
| Login / signup | `(auth)/login`, `(auth)/signup` | Signup: Driver ID for drivers |
| **Home** | `(app)/home` | Day-of-week card, current load, quick-add, change trailer. Migrate away from dashboard-as-home |
| **Loads** | `(app)/loads`, `(app)/loads/[id]` | Month cards → older list; detail any period |
| **Feed** | `(app)/feed`, `(app)/feed/[reportId]` | Latest damage; Notice + comments |
| **Report** | `(app)/report` | Two cards: tractor / trailer |
| Report capture | `(app)/report/tractor`, `(app)/report/trailer` (or reuse `damage`/`tractor` paths under Report) | Capture → R2 → DB |
| **Profile** | `(app)/profile` | Details + notifications list |
| Export | `(app)/export` or detail action | Canvas composite JPG — tool, not a nav tab |
| Safety inbox | `(app)/safety/inbox` | Safety (+ Admin); link from Home/Profile |
| Admin users | `(app)/admin/users` | Admin only; link from Profile |
| Legacy placeholders | `(app)/dashboard`, `(app)/damage/*` | Redirect or fold into Home / Report / Feed |
| API | `api/health`, `api/uploads/presign` | Presign PUT live; see [r2-setup.md](r2-setup.md) |
| PWA | `sw.ts`, `~offline`, `manifest.ts` | Icons still missing |

**Bottom nav** in `(app)/layout`: Driver always shows the five tabs above. Safety/Admin: hide **Report**; optionally hide or repurpose **Loads**; same Feed/Home/Profile labels where possible.

Components under `src/components/{auth,camera,damage,export,loads,pwa,safety,admin,feed,profile}/` as screens land.

---

## Data model changes needed

Source of truth remains `supabase/migrations/`. Do **not** invent columns in app code only — add migrations + update `src/types/database.ts`.

### Schema in `001_init.sql` (apply once on healthy Postgres)

- `profiles` — `role` (`driver` | `safety` | `admin`), `driver_id` nullable with **partial unique** index (required for drivers; null OK after Admin promotes safety/admin); optional `work_state` (USPS 2-letter) + `show_work_state_on_home` for Home welcome “out of {State}”
- `loads`, `load_stops`, `load_trailer_history`
- `damage_reports` — `asset_type` + `asset_number` (trailer | tractor); `report_comment`; R2 + GPS fields
- `damage_notices` — Notice storage; unique per (report, user); **extend RLS** so Drivers (not only Safety/Admin) can insert/delete own notices for Feed
- `safety_inbox_items` — referrals; one **pending** per report; drivers send own; Safety/Admin update status
- `damage_report_comments` — Feed replies (in `001` for greenfield; live Cloud also has `002_report_comments.sql`)
- View `damage_reports_with_notice_count` (`security_invoker`)
- RLS helpers: `is_driver` / `is_safety` / `is_admin` / `is_safety_or_admin` (from `profiles.role`, not JWT user_metadata)
- Signup trigger always inserts `role = driver` + required `driver_id`; Admin updates role (trigger blocks non-admin role changes)

### Follow-on migrations (product gaps for this IA)

- ~~**`damage_report_comments`**~~ — **done** (`002_report_comments.sql` + mirrored in `001_init.sql`)
- ~~**Notifications**~~ — **done** (`004_notifications.sql` + mirrored in `001_init.sql`); Profile list + unread badge; triggers on notice/reply/inbox/load assign
- ~~**Profile work state**~~ — **done** (`009_profile_work_state.sql` + mirrored in `001_init.sql`); Home welcome “out of {State}” when enabled
- Optional rename noticed → viewed column names (UI already can say Notice)
- Company / fleet tenancy scoping
- Generated TypeScript types (`supabase gen types`)

---

## Phased MVP build order

Build **app features** in this order. Infra continues in parallel (see Out of scope / TASKS).

### Phase 0 — Unblock data (parallel)

- Point app at **Supabase Cloud**; apply `001_init.sql` (+ follow-on `002_report_comments` already applied; still need notifications / Notice-RLS for drivers).
- Configure Auth redirect URLs for localhost / production.
- Keep `R2_PUBLIC_URL` as a public/CDN base (r2.dev or custom domain — not the S3 API host).
- R2 CORS must allow browser PUT from localhost / production (see [r2-setup.md](r2-setup.md)).
- Details: TASKS.md + env/R2 checklists.

### Phase 1 — Auth + roles + 5-tab shell

- Wire login/signup; Driver ID uniqueness UX.
- `profiles.role`; protect routes; **role-aware 5-tab bottom nav** (Driver full five; Safety/Admin hide Report, Admin entry on Profile).
- Minimal Admin: list users, set roles (from Profile).

### Phase 2 — Home + Loads

- Home: day-of-week card, current load, quick-add, change trailer.
- Loads: current-month cards; older list; detail by month/week.
- Admin fleet loads view/assign.

### Phase 3 — Report (trailer + tractor) + R2

- Report hub (two cards); presign + capture → R2 → DB for both asset types (include `report_comment`).
- Shared camera/upload components; keys `damage/{assetType}/{asset}/{uuid}.ext`.
- Export path can follow or stay stub briefly.

### Phase 4 — Feed (Notice + comments)

- Feed list + detail for latest damage (both asset types); show `report_comment`.
- Notice → `damage_notices`; extend driver RLS.
- Feed reply UI on `damage_report_comments` (schema done).
- Send to Safety from own report detail.

### Phase 5 — Safety inbox + Profile notifications

- Safety inbox UI; open referral → photo + metadata + Notice.
- Profile: driver details.
- Notifications list + unread badge (schema + wiring).

### Phase 6 — Polish

- PWA icons; canvas export; mobile UX; empty/error states.
- Fold legacy dashboard/damage/search routes into the 5-tab IA.
- Tighten RLS / company scoping later.

---

## Out of scope for now

- Finishing remote Postgres / VPN / host firewall if still blocked — track under TASKS/infra; use host SQL editor when possible.
- Supabase MCP agent access (optional convenience).
- Multi-company tenancy, advanced analytics, automatic damage ML.
- Exotic Admin (payroll, ELD, ticketing workflows, custom report builders).
- Offline-first sync queues beyond Serwist basics.
- Push/OS notifications (MVP can be in-app Profile list only; push later).
- Renaming every “noticed” DB identifier in one big bang before MVP ship (product copy can say Notice / Noticed first).

---

## Implementation notes for agents

- Prefer mobile `max-w-lg`, touch targets; keep **5-tab** bottom nav in `(app)/layout` (role-aware visibility).
- Photos → R2 only; DB stores `r2_key` / optional `r2_url` + GPS + timestamps + driver/asset snapshots. No `content_type`/`byte_size` columns in MVP (type is on the signed PUT). Feed display needs public `R2_PUBLIC_URL` (or later signed GET).
- Never commit `.env.local` or put secrets in docs.
- Schema changes = new migration + `src/types/database.ts`; do not invent columns.
- Notice ≠ comment ≠ Send to Safety; never re-upload for Notice.
- Read Next.js guidance under `node_modules/next/dist/docs/` before new App Router APIs.
