# Legacy: self-hosted Supabase Kong / name resolution

> **Status: optional / legacy.** PrivateFleet’s primary backend is now **Supabase Cloud** (`mvrbfyoujggqazsicgal`). Use [supabase-env-checklist.md](supabase-env-checklist.md) for the current setup.

Keep this note only if you revive the old Docker / Coolify stack at `data.privatefleet.app`.

---

## Symptom (self-hosted)

API calls to the public host returned:

```json
{"message":"name resolution failed"}
```

with HTTP **503**. That meant **Kong could not resolve upstream container hostnames** inside Docker — not a bad Next.js `NEXT_PUBLIC_SUPABASE_URL`.

## Fix outline (self-hosted only)

1. On the VPS, confirm compose service names match Kong upstreams (`auth`, `rest`, `realtime`, `storage`, `meta`, etc.).
2. After Coolify-style redeploys, restart the **entire** Supabase stack so DNS inside the Docker network is consistent.
3. Confirm `SITE_URL` / `API_EXTERNAL_URL` / `SUPABASE_PUBLIC_URL` are real hosts (no unsubstituted `$(PRIMARY_DOMAIN)`).
4. Verify `/auth/v1/health` and `/rest/v1/` return **200** on the public host.

## App path today

Point `.env.local` at Cloud:

- `NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co`
- Publishable / anon + service role keys from the Cloud dashboard

Do not expect the Next.js app to talk to `data.privatefleet.app` unless you intentionally bring that stack back online.
