# PrivateFleet — Task List

**Start here for day-to-day work.** Product scope and data model live in the canonical plan — do not reinvent them here.

## Canonical docs

| Doc | Use for |
| --- | --- |
| [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) | **Canonical product plan** — roles, flows, IA, schema extensions, phases |
| [docs/supabase-env-checklist.md](docs/supabase-env-checklist.md) | Cloud env vars, Auth redirects, migration checklist |
| [docs/r2-setup.md](docs/r2-setup.md) | R2 bucket + public/CDN URL |
| [docs/easypanel-deploy.md](docs/easypanel-deploy.md) | Easypanel / Nixpacks deploy + env parity |
| [docs/supabase-deploy-fix.md](docs/supabase-deploy-fix.md) | **Legacy** self-hosted Kong notes (optional) |
| [docs/supabase-mcp-fix.md](docs/supabase-mcp-fix.md) | Hosted Supabase MCP setup |

**Do not commit `.env.local`.**

---

## Status snapshot (verified)

| Track | Status | Notes |
| --- | --- | --- |
| Supabase Cloud (`mvrbfyoujggqazsicgal`) | **OK** | `ACTIVE_HEALTHY`; migrations through `027_trailer_history_on_current_only` applied |
| App env | **OK** | `.env.local` → `https://mvrbfyoujggqazsicgal.supabase.co`; publishable key matches dashboard |
| Migrations `001`–`009` (core MVP) | **Applied** | Init, comments, notice RLS, notifications, signup/role locks, notice view, photos, work_state |
| Migrations `010`–`027` (loads / feed / safety / profile) | **Applied** | Load stops/trailers, one-active/pending, view counts, nested replies, safety scope, admin delete, inbox RLS fix, identity edits, reply notify, safety home stats, notification copy, comment beeps, trailer history on current only |
| R2 API credentials + bucket | **OK** | Verified earlier |
| `R2_PUBLIC_URL` | **OK** | Public `*.r2.dev` base (Feed display) |
| R2 ↔ Supabase contract | **Aligned** | Schema + presign + insert match; CORS is manual on Cloudflare |

---

## What's left at a glance

### Manual (you)

- [ ] Set Supabase Auth Site URL / redirect allowlist in the dashboard for real localhost signup/login E2E
- [ ] Decide email confirmation mode for MVP vs real SMTP
- [ ] Reconfirm R2 CORS/public access and run one end-to-end upload/feed smoke test
- [ ] Add production Auth redirect origins and R2 CORS before deploy

### Phase 6 polish (open items)

- [ ] Make Report camera capture open the device camera by default
- [ ] Add shared app-header top padding / safe-area handling
- [ ] Improve GPS freshness / accuracy on damage reports
- [ ] Finish true PWA hardening (install CTA, safe areas, install smoke tests, light offline shell)
- [ ] Polish mobile UX plus empty/error states
- [ ] Tighten RLS / company scoping
- [ ] Migrate deprecated `src/middleware.ts` convention to `proxy.ts`

### Later backlog

- [ ] Generated DB types instead of hand-typed rows
- [ ] Photo compression and any extra PWA/offline polish beyond Phase 6
- [ ] Optional DB rename from noticed → viewed terms
- [ ] Push / OS notifications
- [ ] Optional GPS `accuracy` persistence
- [ ] New feature ideas: add future user-requested build plans under `New feature backlog`

---

## Manual (you) — remaining

### Supabase Auth (before real signup/login E2E)

- [ ] Dashboard → Authentication → URL Configuration: set Site URL `http://localhost:3000` and redirect allowlist `http://localhost:3000/**` (app-side redirect handling is shipped; this manual dashboard setting is still required before real E2E signup/login)
- [ ] Decide email confirmations (autoconfirm for local MVP vs real SMTP)

### Product inputs (as needed)

- [ ] Confirm **Driver ID** format/rules (length, characters, uniqueness messaging) if company-specific

### Cloudflare R2 (uploads + Feed photos)

- [ ] Confirm bucket CORS allows `PUT` (and `GET`/`HEAD`) from `http://localhost:3000` — see [docs/r2-setup.md](docs/r2-setup.md) §6
- [ ] Confirm public access / r2.dev (or custom domain) still matches `R2_PUBLIC_URL` so Feed thumbnails load
- [ ] Smoke test: Report capture → object in R2 → Feed thumbnail visible
- [ ] Before production deploy: add production origin to R2 CORS + Auth redirect URLs

### Optional / legacy

- [ ] Ignore or decommission old self-hosted stack at `data.privatefleet.app` when ready
- [ ] Remove obsolete `supabase-selfhosted` from user-level `~/.cursor/mcp.json` if still present (project MCP is Cloud-only)

---

## Upcoming — remaining build (by phase)

Aligned with [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) **Phased MVP build order**. Infra Phase 0 is largely done — wire real Auth/clients instead of mocks.

### Phase 0 — Unblock data

- [x] Point app at Supabase Cloud
- [x] `001_init.sql` applied; REST exposes MVP tables
- [x] `R2_PUBLIC_URL` public/CDN base
- [x] App-side localhost Auth redirect support is wired; see Manual above for the remaining Supabase dashboard Site URL / allowlist step before real E2E auth
- [x] Notice RLS for drivers (`003_notice_rls_drivers.sql`)

### Phase 1 — Auth + roles + 5-tab shell

- [x] Solid login + signup UI (Driver ID on signup for drivers)
- [x] Protect `(app)` routes; **role-aware 5-tab nav** — Home / Loads / Feed / Report / Profile (Safety/Admin: hide Report; Safety hides Loads; Admin users + inbox from Profile)
- [x] Real Supabase Auth + `profiles.role`
- [x] Minimal Admin: `(app)/admin/users` — list users, set role (entry from Profile)
  - Note: Shell + role-aware nav live; Phases 2–5 feature UIs shipped. Legacy `/dashboard` + `/damage/*` redirect into the 5-tab IA. Confirm Auth Site URL / redirects under Manual above before E2E signup.
  - Role is `public.profiles.role` (not Auth Users). First admin bootstrapped: `admin@privatefleet.app` → `admin`. See [docs/supabase-env-checklist.md](docs/supabase-env-checklist.md) § “Where is user role?”.

### Phase 2 — Home + Loads

- [x] Home: day-of-week card, current load details, quick-add load, change trailer
- [x] Loads: current-month cards; older compact list; detail any month/week
- [x] Admin fleet loads view / assign stubs as needed
- [x] Load stop types / completed / starting trailer / nullable trailer / one active / pending (`010`–`016`)
- [x] Trailer history UI on load detail; history writes on current load only (`027`)

### Phase 3 — Report (trailer + tractor) + R2

- [x] Report hub: two cards (tractor / trailer) → capture flows
- [x] Capture UI: camera / file placeholder + GPS optional + metadata fields + **`report_comment`** (multi-line)
- [x] Tractor: multi-photo upload, no route field, 6-digit number (`23-1212`), hidden GPS/`captured_at`
- [x] Implement `POST /api/uploads/presign` + live R2 uploads → DB row (`asset_type`, `report_comment`)
- [x] Schema: `damage_reports.report_comment` (trailer + tractor; truck = tractor)
- [x] Schema: `damage_report_photos` child table (`008`) — one Feed card, many photos

### Phase 4 — Feed (Notice + comments)

- [x] Feed list + detail (latest trailer/tractor damage); show `report_comment` on detail
- [x] Feed list UX: week filter cards, search + pagination (`20/page`), View Damage CTA, relative timestamps, Location links, view/notice counts, Safety status tags
- [x] **Notice** control → `damage_notices`; extend RLS so Drivers can notice (not Safety-only) — `003_notice_rls_drivers.sql` applied
- [x] Schema: Feed replies table `damage_report_comments` + RLS (`002_report_comments.sql`)
- [x] Feed detail UX: masonry photo gallery + lightbox, owner-only one-shot Send to Safety, one-way Notice for other drivers, Report Export auto-download
- [x] **Feed reply UI** on report detail — list/insert/edit/delete own replies; nested replies (`018_comment_parent_id.sql`) + reply-thread UI; comment **beeps** (one-way like Notice) — `026_comment_beeps.sql` + Feed UI
- [x] Driver **Send to Safety** on own report; never duplicate photos for Notice
- [x] Damage report view counts (`017`)

### Phase 5 — Safety inbox + Profile notifications

- [x] Safety: role-scoped `(app)/safety/inbox` feed (not full fleet) with list + detail, status filters, photo/metadata, Notice, and inbox UI polish
- [x] Safety role scope + home stats (`019`, `024`); inbox RLS recursion fix (`021`)
- [x] Admin delete damage reports (`020`)
- [x] Profile: driver details (id, first + last initial → `full_name`, email + privacy hint, role); Appearance Light/Dark only
- [x] Profile setup gate — drivers need name + `work_state` before Loads/Report (`profile-complete` + middleware redirects)
- [x] Profile identity edit limits + Contact Admin email (`022`, Resend)
- [x] Notifications list + unread badge — `004_notifications.sql` + wiring (triggers on notice/reply/inbox/load assign); list lives on Feed (“Latest Notifications”), badge on Feed tab
- [x] Notification copy + comment-reply notifies (`023`, `025`)

### Phase 6 — Polish

#### Done

- [x] Canvas export (photo + white metadata strip → JPG) — `/export` tool, same-origin image proxy for canvas fetches, and multi-photo sequential download
- [x] Brand favicon + PWA icons from logo (`src/app/icon.png`, `favicon.ico`, `public/icons/*`, apple-touch-icon)
- [x] Light / dark theme — class on `<html>`, brand CSS tokens (white+blue/gold light; B/W/gray dark), Profile Light/Dark toggle (no System; `pf-theme`)
- [x] Bottom nav icons; Home welcome + driver ID + ISO week on day card; notifications under Feed with Feed-tab badge
- [x] Profile `work_state` (USPS) + welcome “{Name} out of {State}” (`009_profile_work_state.sql`)
- [x] Fold legacy `/dashboard` + `/damage/*` into 5-tab IA (redirects to Home / Report / Feed)
- [x] PWA baseline: Serwist SW + `/~offline`, `manifest.ts` (`display: "standalone"`, 192/512 + maskable), root `appleWebApp` capable + status bar
- [x] Deploy docs: [docs/easypanel-deploy.md](docs/easypanel-deploy.md) (Nixpacks / env build+runtime)

#### Still open

- [ ] Mobile UX + empty/error states polish
- [ ] Tighten RLS / company scoping later
- [ ] Next 16: migrate `src/middleware.ts` → `proxy.ts` (deprecated middleware convention; keep until polish)
- [ ] Report photo uploader opens the **device camera** by default (not gallery/media library first)
  - Current: `src/components/camera/photo-capture.tsx` uses `<input type="file" accept="image/*">` with **no** `capture` attribute (button copy says “Open Camera” but OS often opens the media picker).
  - Planned: add `capture="environment"` (rear camera) on the Report file input; keep `accept="image/*"`.
  - Stretch if needed: `getUserMedia` live preview.
  - Verify on iOS Safari + Android Chrome; desktop keeps file-picker fallback.
- [ ] Add more **top padding** to the shared app header on all authenticated pages
  - Shared in `src/app/(app)/layout.tsx` (`px-4 pt-4 pb-4`) + `AppPageHeader` (`pt-1`) — **no** `safe-area-inset` yet.
  - Bump layout wrapper and/or header `pt-*` once so every `(app)` page gets it.
  - Prefer safe-area aware padding for notched phones / installed PWA (`env(safe-area-inset-top)`).
- [ ] Improve GPS quality when submitting damage reports (more accurate / fresher coords from the device)
  - Current helper: `src/lib/geolocation.ts` — single `getCurrentPosition` with `enableHighAccuracy: true`, `timeout: 10_000`, `maximumAge: 60_000`; only stores lat/lng; silent `null` on deny/fail.
  - Used from `DamageCaptureForm` (`src/components/damage/damage-capture-form.tsx`) at submit time.
  - Planned: lower `maximumAge` (or `0`) for a fresh fix; longer timeout and/or short `watchPosition` until accuracy ≤ ~50m or timeout; warm GPS when opening Report (not only on submit); clear UI when permission denied / fix unavailable.
  - Optional follow-up: persist `accuracy` (needs migration + types) — not required for first pass.
- [ ] Harden the app into a **true installable PWA** (install prompt, standalone shell polish, offline, safe areas)
  - Baseline already shipped (see Done above). Still missing: safe-area insets on header + bottom nav, install CTA (`beforeinstallprompt` / iOS “Add to Home Screen”), smoke-tested install on Android Chrome + iOS Safari, session-in-standalone check.
  - Offline: keep `/~offline` fallback; minimal shell caching for auth/app chrome (don’t over-cache authenticated API/R2).
  - Align `start_url` / scope with post-login entry (e.g. `/` → home) — verify in production HTTPS.

**Remaining gaps (Phase 6):** camera `capture` on Report, shared header top/safe-area padding, mobile GPS quality, true-PWA hardening (install CTA + safe areas + install smoke tests), Mobile UX/errors, RLS/company scoping, and middleware→`proxy.ts`.

### Later (not MVP-blocking)

1. [ ] Company / fleet scoping without weakening insert checks
2. [ ] Generated DB types (`supabase gen types`) instead of hand-typed rows
3. [ ] Photo compression; any leftover offline/PWA polish beyond Phase 6 true-PWA hardening
4. [ ] Deploy / hosting env parity (docs written; production CORS/Auth origins + live smoke still Manual)
5. [ ] Optional DB rename noticed → viewed identifiers
6. [ ] Push / OS notifications (MVP is in-app Feed list only)
7. [ ] Optional: persist GPS `accuracy` on damage reports (migration + types)

---

## New feature backlog

New feature ideas from the user go here.

Each feature suggestion gets a numbered build plan with ordered checkbox tasks. Add new features in the order they are suggested. Use `[ ]` for open tasks and `[x]` when done.

### Feature 1: App launch splash screen — suggested 2026-07-16

1. [ ] Confirm when the splash screen should appear, including first app open, every cold start, installed PWA launch, browser refresh, and post-login transitions.
2. [ ] Identify the existing PrivateFleet logo asset/source to reuse, or create a properly sized app logo asset if the current icon is not suitable for a centered splash.
3. [ ] Build the splash screen UI layout with the logo centered on the page and the exact title text `Welcome Private Fleet Driver` under the logo.
4. [ ] Wire the splash timing and redirect/handoff behavior into the app startup flow without bypassing the existing auth, profile-complete, or role-aware navigation guards.
5. [ ] Ensure the layout uses mobile-safe spacing, safe-area padding, and readable light/dark theme colors.
6. [ ] Verify PWA/app-open behavior in standalone and browser modes, including that the splash does not block auth checks, redirects, or normal navigation.
7. [ ] Test the splash experience on mobile and desktop viewport sizes, covering signed-out, signed-in driver, Safety, and Admin startup paths.

### Feature 2: Account hub, work-week loads, and ADP — suggested 2026-07-16

1. [x] Document Feature 2 ordered build plan in TASKS.md
2. [x] Migrations: week_start/off_days, load mileage/pay fields, adp_entries, contact_requests; tighten loads RLS to owner-only; update database.ts (migration `028_account_loads_adp` applied on Cloud; `src/types/database.ts` mirrors it)
3. [x] Bottom nav Account + /account hub, nested notifications/legal/contact; /profile redirect (legacy `/profile` → `/account` via middleware + redirect page)
4. [x] Driver settings UI: week start, off days, manual ADP entries + recharts history
5. [x] Create/complete forms: starting/ending mileage, paid miles, pay amount; driven_miles display
6. [x] Home: 7 day cards from week_start + ADP + day totals/empty states
7. [x] Loads page: work-week charts + monthly running totals
8. [x] Draft Privacy/Terms content; Contact form emailing admins (Resend + `contact_requests` audit row)

### Feature 3: Home work stats cards — suggested 2026-07-16

1. [x] Add owner-scoped `getMonthLoadStats(userId, year, month)` query (minimal `status, pay_amount` columns, excludes cancelled) returning current-calendar-month load count + completed-load earnings.
2. [x] Add `summarizeWorkWeekStats` helper computing week non-cancelled load count + completed-load earnings from already-fetched week loads (no extra query).
3. [x] Render a `Work Stats` section below the Home 7-day grid with 4 compact mobile-first cards: Week loads, Month loads, Week earnings, Month earnings.
4. [x] Wire Home page to pass week stats + month stats; preserve existing ADP/quick-add/active-load/grid/Safety/Admin behavior.
5. [x] Verify tsc + eslint clean for touched files.

### Feature 4: Loads page pagination UX — suggested 2026-07-16

Mirror Feed’s URL-driven list controls on Loads: current month starts as a short recent preview, then expands to the full month; month navigator still browses other months.

**UX choice:** Current month defaults to the 5 most recent loads with a “View full month” CTA (`?view=full`). Non-current months opened via the month navigator show the full month immediately (user already chose that month). Charts and monthly totals always use the full-month dataset.

1. [x] Study Feed pagination (`feed/page.tsx`, `FeedPagination`, `feedHref`) and current Loads page / queries / analytics sections.
2. [x] Add `loadsHref` helper and `LoadsListExpand` CTA (touch-friendly, URL-driven like Feed).
3. [x] Wire Loads page: current-month preview of 5 most recent; `?view=full` expands; preserve month navigator; keep charts + month totals on full month data.
4. [x] Document non-current-month behavior (full list immediately) in this Feature 4 plan.
5. [x] Verify tsc + eslint clean for touched files.

### Feature 5: Header notification bell — suggested 2026-07-16

Move notifications off the Feed page into a shared header bell on every `(app)` page.

1. [x] Study app header, layout unread counts, `NotificationsList`, Feed page section, account notifications page, and `animate-feed-badge-pulse`.
2. [x] Add header Bell to the right of the welcome chip; server-fetch last 5 + unread + has-more in `(app)/layout` and pass props into `AppPageHeader`.
3. [x] Bell pulses when unread; click opens mobile-friendly modal of last 5 with mark-as-read + deep links; “View all notifications” → `/account/notifications` when more than 5.
4. [x] Remove the Feed page notifications section entirely; keep bottom-nav Feed badge; simplify account `NotificationsList` to a full scrollable list.
5. [x] Verify tsc + eslint clean for touched files.

### Feature 6: Active-load landing, Home highlight, stop trailer — suggested 2026-07-16

1. [x] Home active-load card: yellow/amber highlight in light mode (readable dark tint).
2. [x] Shared `getPostAuthLandingPath`: active load → `/loads/[id]/edit`; else setup gate or `/home`.
3. [x] Wire login, middleware auth-path, and `/` redirects to the landing helper (preserve profile setup).
4. [x] Inline stop Trailer input on load detail (+ day card checklist); persist via `updateStopTrailerNumber` + sync current trailer.
5. [x] Verify tsc + eslint clean for touched files.

### Feature 7: Departed stops, Depart History, archive/delete, stats scoping — suggested 2026-07-16

1. [x] Migration `029`: `loads.status` + `archived`, `archived_at`, owner DELETE RLS; `arrived_at` = departed timestamp.
2. [x] Stop checkbox UX: checked = **Departed**; disable uncheck; server rejects uncheck; set `arrived_at` on depart.
3. [x] Replace Trailer history UI with **Depart History** (stop name, type, trailer, departed time) on detail + edit.
4. [x] **Archive load** (active/pending → archived, clear trailer, promote pending); **Delete load** only after archived (hard delete).
5. [x] Stats aggregations count only `status === 'completed'` (Home day totals + work stats, Loads month totals + charts).
6. [x] Update `src/types/database.ts`; apply migration via Supabase MCP; verify tsc + eslint.

### Feature 8: Home active-load quick view/edit + today day-card live stats — suggested 2026-07-16

1. [x] Expand yellow ACTIVE LOAD card: tractor (placeholder), current trailer, current stop, Open → edit.
2. [x] Fetch active load with stops; current stop = first undeparted by `delivery_order`.
3. [x] Reuse `StopTrailerField` on current stop; refresh updates current trailer.
4. [x] Today / active `load_date` day card: live preview (loads / earn / driven) from active load; "—" when pay/driven unset.
5. [x] Work Stats strip stays completed-only; completed day cards stay completed-only.
6. [x] Verify tsc + eslint on touched files.
7. [x] Optional later: store current tractor on profile or load — done in Feature 9.

### Feature 9: Persistent driver current truck number — suggested 2026-07-16

1. [x] Migration `030`: `profiles.current_truck_number`, `loads.truck_number` snapshot; apply via Supabase MCP.
2. [x] Update `database.ts` + profile selects (`profile.ts`, `queries.ts`).
3. [x] Account Settings: Current truck number input with save (`updateCurrentTruckNumber` + week settings UX).
4. [x] Create load: stamp `truck_number` from profile; Account link + ClickableTooltip; show current value.
5. [x] Home Active Load Tractor from load snapshot (fallback profile); load detail shows Truck #.
6. [x] Verify tsc + eslint on touched files.

### Feature 10: Optional mileage on past loads — suggested 2026-07-23

Allow drivers logging old loads to leave starting/ending odometer blank when they did not record mileage. Same-day loads still require starting mileage; ending mileage stays required when starting was set or the load date is today. Paid miles and pay amount rules unchanged. Driven miles stay null when either odometer is missing; stats still count earnings and skip null driven totals.

1. [x] Create/update load actions: require `starting_mileage` only when `load_date === today`; keep paid miles required.
2. [x] Complete load: require ending mileage only if starting was set OR load_date is today; allow complete without odometer for old blank loads.
3. [x] Load form UI: toggle starting mileage `required` from date field; helper text “Optional for past loads”.
4. [x] Complete-load UI: optional ending when past load had no starting mileage.
5. [x] Verify tsc + eslint on touched files.

### Feature 11: Home Active Load — Complete on last stop — suggested 2026-07-23

1. [x] When only one undeparted stop remains (or all departed), show Complete Load instead of Depart on Home Active Load card.
2. [x] Reuse CompleteLoadButton with `variant="home"`; refresh Home after complete.

### Feature 12: Feed unit search + unit history — suggested 2026-07-23

Digit-normalized trailer/tractor search opens a dedicated unit history page (Feed › unit number) listing all damage reports for that asset. Unit numbers on feed cards and report detail link to the same page. Tractor display format (`##-####`) is preserved; matching compares digits only.

1. [x] `FeedSearch`: normalize query to digits; navigate to `/feed/unit/[digits]` on submit.
2. [x] Unit page `feed/unit/[assetNumber]`: BackLink to Feed, reuse feed cards + pagination; match stored `asset_number` via digit-equivalent values.
3. [x] Clickable unit number on `FeedReportCard` and report detail → unit page.
4. [x] Legacy `/feed?q=` with digits redirects to the unit page.

### Feature 13: Optional pay on complete + 20-day edit lock — suggested 2026-07-23

Pay amount is optional when completing a load (can be filled in later). After completion, pay remains editable for 20 days via `loads.completed_at`, then locks (UI hides edit; server rejects). Null pay counts as 0 in earnings sums.

1. [x] Migration `032`: `loads.completed_at`; backfill completed rows; apply on Cloud; update `database.ts`.
2. [x] `completeLoad` + CompleteLoadButton: pay optional; set `completed_at` on complete.
3. [x] `updateLoadPayAmount` + EditPayAmount + load detail: allow edit only when completed and within 20 days; reject/lock after.
4. [x] Verify tsc + eslint on touched files.

### Feature 14: Admin Users hub — suggested 2026-07-23

Admin bottom-nav **Users** tab with list/detail, contact reply messaging, disable/delete, and reset reports/loads (service-role server actions).

1. [x] Migration `031`: `profiles.disabled_at`, `contact_replies` (+ RLS), admin SELECT on loads; apply on Cloud; update `database.ts`.
2. [x] `src/lib/supabase/admin.ts` service-role client; admin list/detail queries (last active = Auth `last_sign_in_at`, fallback `profiles.updated_at`).
3. [x] Bottom nav Users tab; `/admin/users` list (name, driver id, email, created, report/load counts, last active); `/admin/users/[id]` detail.
4. [x] Contact thread + admin reply → driver Contact tabs Compose | Inbox (`contact_replies`, mark read).
5. [x] Disable / re-enable (`disabled_at` + Auth ban); middleware + login lockout; delete account; reset reports; reset loads (confirmations).
6. [x] Verify tsc + eslint on touched files.

---

## Quick reference — env (no secrets here)

| Variable | Who sets it | Status |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | **You** | SET → Cloud `*.supabase.co` |
| Supabase anon / publishable + service keys | **You** | SET in `.env.local` |
| `R2_*` API keys + bucket | **You** | Done / verified |
| `R2_PUBLIC_URL` | **You** | Done — public `*.r2.dev` base |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | **You** | Needed for Contact Admin email (see easypanel-deploy) |

Full checklists: [supabase-env-checklist.md](docs/supabase-env-checklist.md), [r2-setup.md](docs/r2-setup.md), [easypanel-deploy.md](docs/easypanel-deploy.md).

---

## Completed / foundation (collapsed)

<details>
<summary><strong>Scaffold & foundation — done</strong></summary>

- [x] Next.js 16 App Router, React 19, Tailwind v4, React Compiler
- [x] Route groups: `(auth)` login/signup, `(app)` 5-tab shell + legacy redirects
- [x] Supabase client helpers + session middleware
- [x] `supabase/migrations/001_init.sql` applied on Cloud (roles, asset_type, inbox, viewed RLS); hand types still match
- [x] API: `GET /api/health`, `POST /api/uploads/presign` (live R2 PUT)
- [x] R2 helpers (`src/lib/r2.ts`), canvas export
- [x] Serwist PWA wiring + icons under `public/icons/*`
- [x] Component folders; README + project-overview rules + **BUILD_PLAN**
- [x] R2 API credentials verified
- [x] `R2_PUBLIC_URL` public/CDN base set (`*.r2.dev`)
- [x] Switched primary backend from self-hosted to Supabase Cloud

**Scaffold note:** Phases 1–5 + most post-MVP feed/safety/profile work are implemented. Remaining gaps are Phase 6 polish (Report camera `capture`, header/safe-area padding, mobile GPS quality, true-PWA install/safe-area hardening, Mobile UX, middleware→proxy, RLS tightening) plus Manual Auth/R2/production checklist.

</details>

<details>
<summary><strong>Docs & infra notes already written</strong></summary>

- [x] [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) — roles, flows, IA, schema, phases
- [x] [docs/supabase-env-checklist.md](docs/supabase-env-checklist.md) — Cloud-first env
- [x] [docs/r2-setup.md](docs/r2-setup.md) — bucket, tokens, public URL
- [x] [docs/easypanel-deploy.md](docs/easypanel-deploy.md) — Easypanel / Nixpacks deploy
- [x] [docs/supabase-deploy-fix.md](docs/supabase-deploy-fix.md) — legacy self-hosted Kong notes
- [x] [docs/supabase-mcp-fix.md](docs/supabase-mcp-fix.md) — hosted MCP

</details>
