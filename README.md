# PrivateFleet

Mobile-first PWA for a private truck fleet: drivers log loads and capture trailer/tractor damage photos; Safety reviews damage and an inbox of items sent for review; Admins manage users and have fleet-wide visibility.

## Who it’s for

| Role | Focus |
| --- | --- |
| **Driver** | Unique Driver ID at signup; log loads; upload trailer & tractor damage; send photos to Safety |
| **Safety** | View fleet damage (trailer + tractor); mark images **viewed**; work the Safety inbox |
| **Admin** | Manage users/roles; full visibility into loads, damage, and inbox |

Canonical product plan: **[docs/BUILD_PLAN.md](docs/BUILD_PLAN.md)**.

## Stack

- **Next.js 16** App Router (`src/app`), React 19, React Compiler
- **Tailwind CSS v4**
- **Supabase Cloud**: Auth + Postgres + RLS
- **Cloudflare R2** for damage photos
- **Serwist** PWA

## Docs

| Doc | Purpose |
| --- | --- |
| [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) | Product vision, roles, flows, IA, data model, MVP phases |
| [TASKS.md](TASKS.md) | Status checklist (infra + build tasks) |
| [docs/supabase-env-checklist.md](docs/supabase-env-checklist.md) | Supabase Cloud / env wiring |
| [docs/r2-setup.md](docs/r2-setup.md) | Cloudflare R2 setup |

## Local development

```bash
npm install
cp .env.local.example .env.local   # then fill values (never commit .env.local)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Env variable names only are listed in `.env.local.example` and the docs above — do not put secrets in this README.

## License

Proprietary. Copyright (c) 2026 Joshua Banks. All rights reserved.

No permission is granted to use, copy, modify, or distribute this software without prior written permission. See [LICENSE](LICENSE).
