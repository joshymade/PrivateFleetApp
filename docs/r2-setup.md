# Cloudflare R2 setup for PrivateFleet

Damage photos are stored in **Cloudflare R2** (S3-compatible). Postgres only stores metadata (`r2_key`, optional `r2_url`, GPS, timestamps, asset/driver snapshots). Image bytes never go in Supabase.

Do **not** commit real credentials. Paste them into `.env.local` only.

## Contract (R2 ↔ Supabase)

| Concern | Where | Notes |
| --- | --- | --- |
| Object identity | `damage_reports.r2_key` (unique, not null) | Stable key used for PUT and later GET |
| Browser display URL | `damage_reports.r2_url` (nullable) | Built at upload from `R2_PUBLIC_URL` + key |
| Content type | Signed into the presigned PUT; not a DB column | Client must send the same `Content-Type` header |
| Size | Not stored (MVP) | Optional later; not required for upload/display |
| GPS / time | `latitude`, `longitude`, `captured_at` | App capture → insert |
| Asset | `asset_type`, `asset_number` | `trailer` \| `tractor` |
| Description | `report_comment` | Upload-time text (not Feed replies) |

**Key convention** (server-generated in `src/lib/r2.ts`):

```text
damage/{assetType}/{sanitizedAssetNumber}/{uuid}.{ext}
```

UUID in the path + `r2_key` unique constraint prevents collisions. RLS does not need to know R2 — auth is on the presign route + Supabase insert policies.

**Upload flow:**

1. Authenticated `POST /api/uploads/presign` → `{ uploadUrl, r2Key, r2Url, contentType }`
2. Browser `PUT` to `uploadUrl` with matching `Content-Type`
3. Insert `damage_reports` with the same `r2_key` / `r2_url`

**Display:** Feed uses `r2_url` when present, else rebuilds `{R2_PUBLIC_URL}/{r2_key}` on the server (`damagePhotoUrl`). That requires a **public** base URL (r2.dev or custom domain), not the S3 API host.

**Canvas export:** Browser loads the photo via auth `GET /api/exports/image?key=<r2_key>` (server `GetObject`). This avoids R2 CORS for export even when the public URL is fine for `<img>` tags.

If the bucket stays fully private with no public/CDN URL, `r2_url` will be null / unusable in `<img>` — Feed preview needs Option A/B; export still works via the proxy as long as R2 API credentials are set.

## 1. Open R2 in Cloudflare

1. Sign in at [https://dash.cloudflare.com](https://dash.cloudflare.com)
2. Select your account
3. In the left sidebar, open **R2 Object Storage** (enable R2 if prompted)

## 2. Note your Account ID

1. On the R2 overview page, copy **Account ID**
2. Set in `.env.local`:

```env
R2_ACCOUNT_ID=<your-account-id>
```

## 3. Create a bucket

1. **Create bucket**
2. Choose a name (e.g. `privatefleet-damage`) — lowercase, no spaces
3. Pick a location hint if offered; create the bucket
4. Set:

```env
R2_BUCKET_NAME=<exact-bucket-name>
```

## 4. Create an API token (S3 credentials)

1. R2 → **Manage R2 API Tokens** (or Account → R2 → API Tokens)
2. **Create API token**
3. Permissions: **Object Read & Write** (scoped to this bucket if possible)
4. Create and **copy both values immediately** (secret is shown once):
   - Access Key ID → `R2_ACCESS_KEY_ID`
   - Secret Access Key → `R2_SECRET_ACCESS_KEY`

```env
R2_ACCESS_KEY_ID=<access-key-id>
R2_SECRET_ACCESS_KEY=<secret-access-key>
```

## 5. Public access / URL (for `R2_PUBLIC_URL`)

Pick one approach. Uploads still use **presigned PUT** via the S3 API; `R2_PUBLIC_URL` is only for readable URLs after upload (Feed thumbnails, detail photo).

### Option A — R2 public bucket / r2.dev subdomain

1. Open the bucket → **Settings**
2. Enable **Public access** / connect an **r2.dev** subdomain if available
3. Copy the public base URL (e.g. `https://pub-xxxxx.r2.dev`)
4. Set:

```env
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
```

(No trailing slash required; app joins `r2_key`.)

### Option B — Custom domain

1. Bucket → **Custom Domains** → connect a hostname (e.g. `damage.privatefleet.app`)
2. Finish DNS as Cloudflare instructs
3. Set:

```env
R2_PUBLIC_URL=https://damage.privatefleet.app
```

Do **not** set `R2_PUBLIC_URL` to `https://<accountId>.r2.cloudflarestorage.com` — that is the S3 API endpoint, not a public object URL.

## 6. CORS (required for browser PUT)

Presigned uploads run **from the browser** to `*.r2.cloudflarestorage.com`. Without CORS, the browser shows **Failed to fetch** (or a CORS error in DevTools) even when credentials and the signature are correct. The Next.js `/api/uploads/presign` route can return **200** while the following PUT to R2 still fails.

**Canvas export** does **not** depend on R2 CORS for GET. Export loads photos via same-origin `GET /api/exports/image?key=…` (server fetches from R2 with API credentials). You still need CORS for uploads (PUT). Including `GET` / `HEAD` in the policy below is still recommended for Feed `<img>` / future direct browser fetches of public URLs.

### Exact steps (local dev)

1. Cloudflare Dashboard → **R2 Object Storage** → open your damage bucket
2. **Settings** → **CORS policy** (Edit CORS policy)
3. Paste the JSON below (keep `http://localhost:3000` for local Next.js)
4. **Save**
5. Hard-refresh the app (`Ctrl+Shift+R`) and submit a damage report again

### Policy for local + production

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://your-production-domain.com"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Notes:

- Origins must match exactly (scheme + host + port). `http://127.0.0.1:3000` is **not** the same as `http://localhost:3000` — add both if you use either.
- The app sends a `Content-Type` header on PUT (signed into the URL). If you prefer a looser policy, `"AllowedHeaders": ["*"]` also works.
- After changing CORS, hard-refresh and retry. In DevTools → Network: look for a failed `OPTIONS` or `PUT` to `*.r2.cloudflarestorage.com`. A successful `POST /api/uploads/presign` with a failing R2 PUT almost always means this section.
- If export previously showed **Failed to fetch**, that was usually a browser `fetch()` of the public R2 URL without CORS — fixed by the `/api/exports/image` proxy. Export still needs valid `R2_*` credentials on the server.

## 7. Map into `.env.local`

Ensure all five are filled (names only — use your real values):

```env
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=
```

S3 endpoint the app uses for signing (not an env var):

`https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`

## 8. When you’re done

1. Save `.env.local` (still gitignored)
2. Confirm CORS + public URL (sections 5–6)
3. Do not paste secrets into chat, `TASKS.md`, or git

## Checklist

- [ ] Bucket created
- [ ] API token with Object Read & Write
- [ ] All five `R2_*` vars set in `.env.local`
- [ ] Public URL or custom domain set for `R2_PUBLIC_URL` (r2.dev / CDN — not `*.r2.cloudflarestorage.com`)
- [ ] CORS allows `PUT` (and preferably `GET`/`HEAD`) from `http://localhost:3000` (and production origin when deployed)
- [ ] Smoke test: Report capture → Feed shows thumbnail
- [ ] Smoke test: Export → Download JPG (uses `/api/exports/image`, not browser→R2 CORS)
