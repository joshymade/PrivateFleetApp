# Supabase MCP (Cloud)

PrivateFleet uses the **official hosted Supabase MCP** against Cloud project `mvrbfyoujggqazsicgal`.

## Project MCP (preferred)

Repo file [`.cursor/mcp.json`](../.cursor/mcp.json):

```json
{
  "mcpServers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp?project_ref=mvrbfyoujggqazsicgal&features=docs%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions%2Cbranching%2Cstorage"
    }
  }
}
```

Also available: Cursor plugin server **`plugin-supabase-supabase`** (same Cloud org/projects after OAuth).

## Auth

Hosted MCP uses OAuth 2.1. If tools show `needsAuth`, run `mcp_auth` for that server, complete the browser login, then rediscover tools.

## What not to use

| Config | Why |
| --- | --- |
| `https://data.privatefleet.app/mcp` | Legacy self-hosted; Kong typically blocks `/mcp`; stack is no longer primary |
| Expecting hosted MCP to manage a self-hosted DB | Hosted MCP talks to Cloud projects only |

Older self-hosted MCP troubleshooting (Kong deny, SSH tunnel) is obsolete for day-to-day PrivateFleet work. See [supabase-deploy-fix.md](supabase-deploy-fix.md) only if reviving Docker.
