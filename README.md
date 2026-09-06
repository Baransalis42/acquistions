# Acquisitions API — Docker Setup

This app connects to [Neon Postgres](https://neon.tech) through the
`@neondatabase/serverless` driver + Drizzle ORM. Locally it talks to a
**Neon Local** proxy container (spinning up a real, throwaway Neon branch per
run); in production it talks to your actual Neon Cloud database directly.
The application code and Docker image are identical in both cases — only the
environment variables differ.

## Files in this setup

| File                       | Purpose                                                              |
| --------------------------- | --------------------------------------------------------------------- |
| `Dockerfile`                 | Multi-stage build with `development` and `production` targets.       |
| `docker-compose.dev.yml`     | Runs the app + a `neon-local` proxy container, for local dev.        |
| `docker-compose.prod.yml`    | Runs just the app, pointed at real Neon Cloud.                       |
| `.env.development`           | Dev env vars (Neon Local connection + Neon Local's own credentials). |
| `.env.production`            | Prod env var **template** (real secrets injected at deploy time).   |
| `.dockerignore`               | Keeps `node_modules`, `.env*`, logs, etc. out of the build context.  |

Both `.env.development` and `.env.production` match the existing `.env.*`
entry in `.gitignore` — they exist on disk for you to use, but are never
committed.

---

## 1. Development: app + Neon Local

Neon Local (`neondatabase/neon_local`) is a small proxy container that
authenticates to Neon Cloud on your behalf and creates a **fresh ephemeral
branch** from your project every time it starts, deleting it again when it
stops. Your app just sees an ordinary Postgres endpoint at
`neon-local:5432` — it has no idea a real cloud branch is being created behind
the scenes.

```
┌────────────────────────────┐        ┌───────────────────┐        ┌───────────────┐
│  app container              │  TCP    │  neon-local          │  HTTPS   │  Neon Cloud      │
│  DATABASE_URL=              │ ──────▶ │  (proxy, port 5432)   │ ───────▶ │  ephemeral branch │
│  postgres://neon:npg@       │        │  auth via NEON_API_KEY │        │  (auto-created/   │
│  neon-local:5432/neondb     │        │  + NEON_PROJECT_ID     │        │   auto-deleted)    │
└────────────────────────────┘        └───────────────────┘        └───────────────┘
```

### Prerequisites

- Docker + Docker Compose
- A Neon account/project
- A Neon API key: [console.neon.tech/app/settings/api-keys](https://console.neon.tech/app/settings/api-keys)
- Your Neon **Project ID**: Project → Settings → General

### Setup

1. Open `.env.development` and fill in:

   ```
   NEON_API_KEY=neon_api_xxx...
   NEON_PROJECT_ID=xxxxxxxx-xxxx-...
   ```

   Leave `PARENT_BRANCH_ID` blank to branch off your project's default
   branch, or set it to branch off a specific existing branch instead.

   `DATABASE_URL` is already set to Neon Local's fixed convention and does
   **not** need to be changed:

   ```
   DATABASE_URL=postgres://neon:npg@neon-local:5432/neondb?sslmode=require
   ```

   (`neon`/`npg` are placeholder credentials required by Neon Local's proxy
   protocol — the real authentication happens via `NEON_API_KEY` — so don't
   swap them for "real" ones.)

2. Start everything:

   ```bash
   docker compose --env-file .env.development -f docker-compose.dev.yml up --build
   ```

   This builds the app's `development` image target, starts `neon-local`
   first, then starts the app with your `src/` directory bind-mounted so
   `node --watch` picks up changes live (no rebuild needed for code edits).

3. The API is now at `http://localhost:3000` (try `GET /health`), backed by
   a brand-new ephemeral Neon branch.

4. Stop with `Ctrl+C` or `docker compose -f docker-compose.dev.yml down`.
   By default (`DELETE_BRANCH: 'true'`) the ephemeral branch is deleted when
   `neon-local` stops, so the next `up` starts from a clean copy of your data
   again — handy for tests, but remember any data you write during a dev
   session disappears afterwards unless you set `PARENT_BRANCH_ID` to reuse
   a persistent branch, or set `DELETE_BRANCH: 'false'` in
   `docker-compose.dev.yml`.

5. Running migrations against the ephemeral branch (while the stack is up):

   ```bash
   docker compose -f docker-compose.dev.yml exec app npm run db:migrate
   ```

> **Note:** the very first request right after `up` can occasionally race
> Neon Local while it finishes provisioning the branch. If you see a
> connection error on the first call, just retry — it resolves within a
> couple of seconds.

---

## 2. Production: app + real Neon Cloud

In production there is **no Neon Local container** — `docker-compose.prod.yml`
only runs the app, and `DATABASE_URL` points straight at your real Neon Cloud
connection string (`...neon.tech`). Nothing about the Dockerfile or app code
changes; only `NODE_ENV` and the connection string differ, which is what
switches `src/config/database.js` out of "Neon Local mode" (see below).

### Setup

1. `.env.production` ships as a **template** with placeholder values — it is
   gitignored and must never hold real secrets in version control. Populate
   real values one of two ways:

   - **Simplest:** on your deployment host / in your CI job, overwrite
     `.env.production` with real values right before starting the stack
     (e.g. your secrets manager or CI writes the file as a deploy step).
   - **Pure env-var injection:** export `DATABASE_URL` / `ARCJET_KEY` in the
     shell that runs `docker compose`, and add an `environment:` block to
     `docker-compose.prod.yml` referencing `${DATABASE_URL}` / `${ARCJET_KEY}`
     — see the comment at the top of that file for the exact caveat around
     unset variables.

   Either way, get your real connection string from the Neon Console →
   your project → **Connection Details**:

   ```
   DATABASE_URL=postgres://<user>:<password>@<endpoint>.neon.tech/<dbname>?sslmode=require
   ```

2. Build and run:

   ```bash
   docker compose -f docker-compose.prod.yml up --build -d
   ```

3. Check health: `curl http://localhost:3000/health`, and container status
   via `docker compose -f docker-compose.prod.yml ps` (a `HEALTHCHECK` is
   baked into the image).

---

## How `DATABASE_URL` switches between environments

The Dockerfile, `package.json`, and application code never hardcode a
connection string or a hostname — they only ever read `process.env.DATABASE_URL`
and `process.env.NODE_ENV`:

| | `docker-compose.dev.yml` | `docker-compose.prod.yml` |
|---|---|---|
| `NODE_ENV` | `development` | `production` |
| `DATABASE_URL` host | `neon-local` (proxy, in-network) | `*.neon.tech` (real Neon Cloud) |
| Source of the value | hardcoded in the dev compose file (Neon Local's fixed local convention) | `.env.production` / injected secret |
| Driver behavior | `src/config/database.js` detects `NODE_ENV !== 'production'` and points the Neon serverless driver's fetch/WebSocket layer at the Neon Local proxy instead of `*.neon.tech` | driver talks to Neon Cloud's HTTPS endpoint exactly as `@neondatabase/serverless` does by default |
| Extra containers | `neon-local` (ephemeral branch per run) | none — Neon Cloud is an external managed service |

That `NODE_ENV` check lives in `src/config/database.js`:

```js
if (process.env.NODE_ENV !== 'production') {
  const localHost = new URL(process.env.DATABASE_URL).hostname;
  neonConfig.fetchEndpoint = `http://${localHost}:5432/sql`;
  neonConfig.useSecureWebSocket = false;
  neonConfig.poolQueryViaFetch = true;
}
```

This is the officially documented way to make `@neondatabase/serverless` work
against Neon Local's proxy instead of Neon's real HTTPS endpoint (see
[Neon Local docs](https://neon.com/docs/local/neon-local)) — in production
this block is skipped entirely and the driver behaves exactly as it would
without Docker in the picture at all.

---

## Local production smoke test (optional)

To sanity-check the production image itself without touching real Neon Cloud,
you can still point `docker-compose.prod.yml` at a Neon Local instance you
start separately (or at a scratch Neon Cloud branch) by overriding
`DATABASE_URL` — just remember `NODE_ENV=production` skips the Neon Local
driver shim above, so this only works against a real HTTPS-reachable Neon
endpoint (Neon Local's HTTP proxy needs the dev-mode driver config to work),
not the plain TCP Neon Local proxy.

---

## Troubleshooting

- **`bcrypt` fails to build / install** — the Dockerfile's `deps` and
  `prod-deps` stages install `python3 make g++` specifically so the native
  `bcrypt` addon can compile on Alpine (musl). If you change the base image,
  keep an equivalent build toolchain.
- **Logs** — Winston writes to `logs/error.log` / `logs/combined.log`
  relative to the working directory; both Dockerfile targets create `logs/`
  ahead of time so this doesn't fail on a fresh container.
- **Port already in use** — Neon Local and the app both publish fixed host
  ports (`5432`, `3000`). Stop any local Postgres/other app using those
  ports, or edit the `ports:` mappings in the compose files.
