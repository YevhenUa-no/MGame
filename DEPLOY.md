# Deploying Cozy Explorer (frontend on Vercel + multiplayer server on Railway)

The game splits into two deploys:
- **Frontend** (Vite/Svelte static build) → Vercel, same as before.
- **Multiplayer server** (`server/server.js`) → Railway, because it's a
  long-running process holding WebSocket connections, which Vercel's
  serverless functions aren't built for.

## 1. Deploy the server to Railway

1. Push this repo to GitHub (Railway deploys from a repo).
2. On [railway.app](https://railway.app), **New Project → Deploy from GitHub repo**, pick this repo.
3. Railway auto-detects Node via the `railway.json` in this repo, which
   sets the start command to `npm run server`. No extra config needed.
4. Once deployed, open the service's **Settings → Networking** and click
   **Generate Domain**. Railway gives you a public URL like
   `cozy-explorer-server-production.up.railway.app`.
5. Your WebSocket URL is that domain with `wss://` in front:
   `wss://cozy-explorer-server-production.up.railway.app`

Railway's free tier is enough for this — it's a single lightweight process
with no database.

## 2. Point the frontend at it

In your **Vercel project → Settings → Environment Variables**, add:

| Key | Value |
|---|---|
| `VITE_MULTIPLAYER_URL` | `wss://cozy-explorer-server-production.up.railway.app` (your Railway URL from step 1) |

Redeploy the Vercel project (env var changes need a redeploy to take effect
in a Vite build, since `import.meta.env` values are baked in at build time,
not read at runtime).

## 3. Verify

Open the deployed Vercel URL in two separate browser windows — you should
see a second capsule avatar walk around and be able to wave at yourself.
Check the browser console for `[network] could not open WebSocket` if it's
not connecting — that usually means the Railway URL is wrong or the
service hasn't finished deploying yet.

## Local development

Nothing changes locally — `network.js` falls back to
`ws://<current-host>:8787` when `VITE_MULTIPLAYER_URL` isn't set, so
`npm run server` + `npm run dev` still works exactly as before without
any `.env` file.

## Alternatives to Railway

Render and Fly.io work the same way — deploy `server/server.js` as a
persistent Node process, point `VITE_MULTIPLAYER_URL` at whatever public
`wss://` URL they give you. Railway is just the least config to get going.
