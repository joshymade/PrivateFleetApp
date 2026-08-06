# Easypanel / Nixpacks deploy

PrivateFleet is a Next.js 16 app. Nixpacks runs `npm run build` then `npm run start`.

## Why builds failed

With `NODE_ENV=production`, `npm ci` / `npm install` **omit `devDependencies`**. The app needs Tailwind PostCSS, TypeScript, esbuild (Serwist), and the React Compiler plugin at **build** time. This repo:

1. Moves those packages into `dependencies` so production installs still get them.
2. Ships `nixpacks.toml` with `NPM_CONFIG_PRODUCTION=false` so install includes the full tree.

The `$NIXPACKS_PATH` warning is usually harmless.

## Env vars in Easypanel

Set these on the service (build **and** runtime for public vars — Next inlines `NEXT_PUBLIC_*` at build):

| Variable | Build | Runtime | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | **Required** | Required | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Required** | Required | Publishable / anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | Required for admin/server paths that use it | Never expose as `NEXT_PUBLIC_` |
| `R2_ACCOUNT_ID` | Optional | Required for photo upload/export | See [r2-setup.md](r2-setup.md) |
| `R2_ACCESS_KEY_ID` | Optional | Required for upload/export | |
| `R2_SECRET_ACCESS_KEY` | Optional | Required for upload/export | |
| `R2_BUCKET_NAME` | Optional | Required for upload/export | |
| `R2_PUBLIC_URL` | Optional | Required for Feed image URLs | `*.r2.dev` or custom CDN — not the S3 API host |

Also add your production origin to Supabase Auth → URL Configuration (Site URL + redirect allow list).

## Node

`package.json` engines: Node `>=20`. Prefer Node 22 on the panel if you can pick a version.
