# PrivateFleet — Task List

**Start here for day-to-day work.** Product scope and data model live in the canonical plan — do not reinvent them here.

## Canonical docs

| Doc | Use for |
| --- | --- |
| [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) | **Canonical product plan** — roles, flows, IA, schema extensions, phases |
| [docs/supabase-env-checklist.md](docs/supabase-env-checklist.md) | Cloud env vars, Auth redirects, migration checklist |
| [docs/r2-setup.md](docs/r2-setup.md) | R2 bucket + public/CDN URL |
| [docs/supabase-deploy-fix.md](docs/supabase-deploy-fix.md) | **Legacy** self-hosted Kong notes (optional) |
| [docs/supabase-mcp-fix.md](docs/supabase-mcp-fix.md) | Hosted Supabase MCP setup |

**Do not commit `.env.local`.**

---

## Status snapshot (verified)

| Track | Status | Notes |
| --- | --- | --- |
| Supabase Cloud (`mvrbfyoujggqazsicgal`) | **OK** | `ACTIVE_HEALTHY`; `/auth/v1/health` → **200** |
| App env | **OK** | `.env.local` → `https://mvrbfyoujggqazsicgal.supabase.co`; publishable key matches dashboard |
| Migration `001_init.sql` | **Applied** | Tables + RLS live (`profiles`, `loads`, damage, inbox, …) |
| Migration `002_report_comments.sql` | **Applied** | `report_comment` on damage_reports; `damage_report_comments` + RLS |
| Migration `003_notice_rls_drivers.sql` | **Applied** | Drivers (all authenticated) can insert/delete own `damage_notices` |
| Migration `004_notifications.sql` | **Applied** | `notifications` + triggers (notice/reply/inbox/load assign) |
| Migration `007_fix_damage_reports_notice_view.sql` | **Applied** | View column `report_comment` (not stale `notes`) |
| Migration `008_damage_report_photos.sql` | **Applied** | Child photos table; cover stays on `damage_reports.r2_*` |
| R2 API credentials + bucket | **OK** | Verified earlier |
| `R2_PUBLIC_URL` | **OK** | Public `*.r2.dev` base (Feed display) |
| R2 ↔ Supabase contract | **Aligned** | Schema + presign + insert match; CORS is manual on Cloudflare |

---

## Manual (you) — remaining

### Supabase Auth (before real signup/login E2E)

- [ ] Dashboard → Authentication → URL Configuration: Site URL `http://localhost:3000`, redirect allowlist `http://localhost:3000/**` (add production origin later)
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
- [x] Auth redirect URLs for localhost (Manual above)
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

### Phase 3 — Report (trailer + tractor) + R2

- [x] Report hub: two cards (tractor / trailer) → capture flows
- [x] Capture UI: camera / file placeholder + GPS optional + metadata fields + **`report_comment`** (multi-line)
- [x] Tractor: multi-photo upload, no route field, 6-digit number (`23-1212`), hidden GPS/`captured_at`
- [x] Implement `POST /api/uploads/presign` + live R2 uploads → DB row (`asset_type`, `report_comment`)
- [x] Schema: `damage_reports.report_comment` (trailer + tractor; truck = tractor)
- [x] Schema: `damage_report_photos` child table (`008`) — one Feed card, many photos

### Phase 4 — Feed (Notice + comments)

- [x] Feed list + detail (latest trailer/tractor damage); show `report_comment` on detail
- [x] **Notice** control → `damage_notices`; extend RLS so Drivers can notice (not Safety-only) — `003_notice_rls_drivers.sql` applied
- [x] Schema: Feed replies table `damage_report_comments` + RLS (`002_report_comments.sql`)
- [x] **Feed reply UI** on report detail — list/insert/edit/delete own replies
- [x] Driver **Send to Safety** on own report; never duplicate photos for Notice

### Phase 5 — Safety inbox + Profile notifications

- [x] Safety: `(app)/safety/inbox` list + detail (photo + metadata + Notice)
- [x] Profile: driver details (id, first + last initial → `full_name`, email + privacy hint, role); Appearance Light/Dark only
- [x] Notifications list + unread badge — `004_notifications.sql` + wiring (triggers on notice/reply/inbox/load assign); list lives on Feed (“Latest Notifications”), badge on Feed tab

### Phase 6 — Polish

- [x] Canvas export (photo + white metadata strip → JPG) — `/export` tool + Feed/Profile links
- [x] Brand favicon + PWA icons from logo (`src/app/icon.png`, `favicon.ico`, `public/icons/*`)
- [x] Light / dark theme — class on `<html>`, brand CSS tokens (white+blue/gold light; B/W/gray dark), Profile Light/Dark toggle (no System; `pf-theme`)
- [x] Bottom nav icons; Home welcome + driver ID + ISO week on day card; notifications under Feed with Feed-tab badge
- [x] Profile `work_state` (USPS) + optional “Show work state on Home” → welcome “{Name} out of {State}” (`009_profile_work_state.sql`)
- [ ] Mobile UX + error states; fold remaining legacy surfaces into 5-tab IA
- [ ] Tighten RLS / company scoping later
- [ ] Next 16: migrate `src/middleware.ts` → `proxy.ts` (deprecated middleware convention; keep until polish)
- [ ] Report photo uploader opens the **device camera** by default (not gallery/media library first)
  - Current: `src/components/camera/photo-capture.tsx` (`PhotoCapture` / used by `DamageCaptureForm`) uses `<input type="file" accept="image/*">` with no `capture`, so mobile often opens the media picker.
  - Planned: add `capture="environment"` (rear camera) on the Report file input; keep `accept="image/*"`.
  - Stretch if needed: `getUserMedia` live preview.
  - Verify on iOS Safari + Android Chrome; desktop keeps file-picker fallback.
- [ ] Add more **top padding** to the shared app header on all authenticated pages
  - Shared in `src/app/(app)/layout.tsx` (`px-4 pt-4 pb-4`) + `AppPageHeader` (`src/components/nav/app-page-header.tsx`, `pt-1`).
  - Bump layout wrapper and/or header `pt-*` once so every `(app)` page gets it.
  - Prefer safe-area aware padding for notched phones / installed PWA (`env(safe-area-inset-top)`).
- [ ] Improve GPS quality when submitting damage reports (more accurate / fresher coords from the device)
  - Current helper: `src/lib/geolocation.ts` — single `getCurrentPosition` with `enableHighAccuracy: true`, `timeout: 10_000`, `maximumAge: 60_000`; only stores lat/lng; silent `null` on deny/fail.
  - Used from `DamageCaptureForm` (`src/components/damage/damage-capture-form.tsx`) at submit time.
  - Planned: lower `maximumAge` (or `0`) for a fresh fix; longer timeout and/or short `watchPosition` until accuracy ≤ ~50m or timeout; warm GPS when opening Report (not only on submit); clear UI when permission denied / fix unavailable.
  - Optional follow-up: persist `accuracy` (needs migration + types) — not required for first pass.
- [ ] Harden the app into a **true installable PWA** (install prompt, standalone shell, offline, safe areas)
  - Current: Serwist wired (`src/app/sw.ts`, `src/app/manifest.ts`, `SerwistProvider`, `/~offline`, icons under `public/icons/*`).
  - Confirm installability on HTTPS: valid manifest, 192/512 + maskable icons, `display: "standalone"`, working SW registration.
  - Apple / iOS meta: `apple-mobile-web-app-capable`, status-bar style, apple-touch-icon (root layout metadata).
  - Safe-area insets for top header + bottom nav in standalone mode.
  - Offline: keep `/~offline` fallback; minimal shell caching for auth/app chrome (don’t over-cache authenticated API/R2).
  - Optional install CTA on Profile or first-run (`beforeinstallprompt` / iOS “Add to Home Screen” hint).
  - Align `start_url` / scope with post-login entry (e.g. `/` → home).
  - Smoke test: install on Android Chrome + iOS Safari; offline relaunch; session persists in standalone (Supabase client already notes PWA launches).

**Remaining gaps (Phase 6):** camera capture on Report, shared header top/safe-area padding, mobile GPS quality on damage reports, true-PWA hardening, plus Mobile UX/errors, RLS/company scoping, and middleware→`proxy.ts`.

### Later (not MVP-blocking)

1. Company / fleet scoping without weakening insert checks
2. Generated DB types (`supabase gen types`) instead of hand-typed rows
3. Photo compression; any leftover offline/PWA polish beyond Phase 6 true-PWA hardening
4. Deploy / hosting env parity
5. Optional DB rename noticed → viewed identifiers
6. Push / OS notifications (MVP is in-app Feed list only)
7. Optional: persist GPS `accuracy` on damage reports (migration + types)

---

## Quick reference — env (no secrets here)

| Variable | Who sets it | Status |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | **You** | SET → Cloud `*.supabase.co` |
| Supabase anon / publishable + service keys | **You** | SET in `.env.local` |
| `R2_*` API keys + bucket | **You** | Done / verified |
| `R2_PUBLIC_URL` | **You** | Done — public `*.r2.dev` base |

Full checklists: [supabase-env-checklist.md](docs/supabase-env-checklist.md), [r2-setup.md](docs/r2-setup.md).

---

## Completed / foundation (collapsed)

<details>
<summary><strong>Scaffold & foundation — done</strong> (scaffold in place; screens mostly placeholders)</summary>

- [x] Next.js 16 App Router, React 19, Tailwind v4, React Compiler
- [x] Route groups: `(auth)` login/signup, `(app)` dashboard / damage / export + bottom-nav shell
- [x] Supabase client helpers + session middleware stub
- [x] `supabase/migrations/001_init.sql` applied on Cloud (roles, asset_type, inbox, viewed RLS); hand types still match
- [x] API: `GET /api/health`, `POST /api/uploads/presign` (live R2 PUT)
- [x] R2 helpers (`src/lib/r2.ts`), canvas export stub
- [x] Serwist PWA wiring (icons still missing)
- [x] Component folders reserved; README + project-overview rules + **BUILD_PLAN**
- [x] R2 API credentials verified
- [x] `R2_PUBLIC_URL` public/CDN base set (`*.r2.dev`)
- [x] Switched primary backend from self-hosted to Supabase Cloud

**Scaffold note (historical):** early placeholders folded into 5-tab IA. Phases 1–5 feature routes are implemented; remaining gaps are Phase 6 polish (Report camera capture, header/safe-area padding, mobile GPS quality, true-PWA hardening, Mobile UX, middleware→proxy, RLS tightening).

</details>

<details>
<summary><strong>Docs & infra notes already written</strong></summary>

- [x] [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) — roles, flows, IA, schema, phases
- [x] [docs/supabase-env-checklist.md](docs/supabase-env-checklist.md) — Cloud-first env
- [x] [docs/r2-setup.md](docs/r2-setup.md) — bucket, tokens, public URL
- [x] [docs/supabase-deploy-fix.md](docs/supabase-deploy-fix.md) — legacy self-hosted Kong notes
- [x] [docs/supabase-mcp-fix.md](docs/supabase-mcp-fix.md) — hosted MCP

</details>
