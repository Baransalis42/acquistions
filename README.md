# Acquisitions API

A REST API for user account management, built to demonstrate a production-shaped
Node.js/Express backend and the DevOps practices around it: containerized dev and
prod environments, a CI/CD pipeline, structured logging, and a security middleware
stack, on top of a small but real feature set (authentication and user CRUD).

This is a learning/portfolio project. The scope is intentionally small — the point
is the surrounding engineering (auth, validation, error handling, database
migrations, Docker, CI/CD) rather than the size of the feature set.

## What this demonstrates

- A layered Express API (routes → controllers → services → ORM) with consistent
  validation, error handling, and logging across every endpoint.
- Cookie-based JWT authentication with role-based authorization (self-or-admin
  checks on write operations, admin-only role changes).
- A managed security stack (Arcjet) doing bot detection, WAF-style shielding, and
  per-role rate limiting in front of the application logic.
- A Postgres schema managed through Drizzle ORM migrations, running against Neon
  (serverless Postgres) in production and a locally-proxied ephemeral branch
  (Neon Local) in development — same application code, different driver
  selected by environment.
- A multi-stage Dockerfile producing distinct development and production images
  from one file, with a non-root runtime user and a baked-in health check.
- Three GitHub Actions workflows covering lint/format, tests with coverage
  reporting, and a multi-platform Docker build/push on release.

## Tech stack

| Choice                                    | Why                                                                                                                                                              |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js 20 (ESM)                          | Current LTS; native ESM avoids a build step for the app itself.                                                                                                  |
| Express 5                                 | Minimal, well-understood HTTP framework with a huge middleware ecosystem.                                                                                        |
| Drizzle ORM                               | Type-safe, SQL-like query builder with a real migration system, without a heavyweight runtime.                                                                   |
| Neon (serverless Postgres)                | Postgres with a true zero-idle-cost serverless mode and ephemeral branches for local dev.                                                                        |
| Neon Local                                | Proxies a real, disposable Neon branch per dev session — no shared dev database, no mocks.                                                                       |
| `@neondatabase/serverless` / `pg`         | HTTP/WebSocket driver against Neon Cloud in production; plain `node-postgres` against Neon Local's TCP proxy in dev/test — selected automatically by `NODE_ENV`. |
| Arcjet                                    | Managed bot detection, shielding, and rate limiting without hand-rolling any of the three.                                                                       |
| `jsonwebtoken` + httpOnly cookies         | Stateless auth that isn't readable from client-side JavaScript.                                                                                                  |
| `bcrypt`                                  | Industry-standard adaptive password hashing.                                                                                                                     |
| Zod                                       | Schema validation with static type inference and a small API surface.                                                                                            |
| Winston                                   | Structured JSON logging, separate error/combined log files plus console in dev.                                                                                  |
| Helmet, `cors`, `cookie-parser`, `morgan` | Standard, well-audited Express middleware rather than custom security code.                                                                                      |
| Docker (multi-stage)                      | One Dockerfile, two purpose-built images (dev with hot reload, prod minimal + non-root).                                                                         |
| Docker Compose                            | Reproducible local stack (app + Neon Local) with a single command.                                                                                               |
| Jest + Supertest                          | Native-ESM-compatible test runner with HTTP-level assertions.                                                                                                    |
| ESLint + Prettier                         | Enforced code style and common bug patterns, checked in CI.                                                                                                      |
| GitHub Actions                            | Free, repo-native CI/CD with no external service to configure.                                                                                                   |

## Architecture overview

```mermaid
flowchart TD
    Client([Client])

    subgraph Express["Express app (src/app.js)"]
        CORS["cors"]
        Helmet["helmet"]
        Body["express.json / urlencoded"]
        Cookie["cookie-parser"]
        Morgan["morgan -> Winston logger"]
        AuthToken["authenticateToken\n(reads JWT cookie, sets req.user if valid - never blocks)"]
        Arcjet["securityMiddleware\n(Arcjet: shield + bot detection + per-role rate limit)"]
        Router{"Router"}
        RequireAuth["requireAuth\n(401 if no req.user)"]
    end

    subgraph Auth["/api/auth"]
        AuthRoutes["auth.routes.js"]
        AuthController["auth.controller.js\n(Zod validation)"]
        AuthService["auth.service.js\n(bcrypt hashing/compare)"]
    end

    subgraph Users["/api/users"]
        UserRoutes["user.routes.js"]
        UsersController["users.controller.js\n(Zod validation + self-or-admin checks)"]
        UsersService["users.services.js"]
    end

    ErrorHandler["error.middleware.js\n(JSON error response, hides stack traces in prod)"]
    DB[("Postgres\nNeon Cloud (prod) / Neon Local (dev)")]

    Client --> CORS --> Helmet --> Body --> Cookie --> Morgan --> AuthToken --> Arcjet --> Router
    Router -->|"/api/auth/*"| AuthRoutes --> AuthController
    Router -->|"GET /api/users*"| RequireAuth --> UserRoutes
    Router -->|"PUT/DELETE /api/users/:id"| UserRoutes
    UserRoutes --> UsersController
    AuthController --> AuthService --> Drizzle["Drizzle ORM"]
    UsersController --> UsersService --> Drizzle
    Drizzle --> DB
    AuthController -. error .-> ErrorHandler
    UsersController -. error .-> ErrorHandler
    ErrorHandler -.-> Client
```

Every request passes through the same middleware chain regardless of route.
`authenticateToken` is non-blocking — it only populates `req.user` when a valid
JWT cookie is present, and lets the request continue either way. Whether
authentication is actually _required_ is decided further down: the `GET`
routes on `/api/users` use a dedicated `requireAuth` middleware, while
`PUT`/`DELETE /api/users/:id` and the self-or-admin/role checks are enforced
inline in `users.controller.js`, since they need to compare `req.user` against
the specific resource being modified, not just check that it exists.

## Features

- Sign up, sign in, sign out with JWT issued as an httpOnly, `sameSite=strict`
  cookie (15-minute lifetime by default).
- Passwords hashed with bcrypt; only non-sensitive columns are ever selected or
  returned from any endpoint.
- Role-based access: any authenticated user can list/read users; a user can
  update or delete only their own account; only an `admin` can change a
  user's `role`.
- Zod validation on every request body/param, with consistent
  `{ error, details }` responses on failure.
- Arcjet-backed bot detection, shielding, and a rate limit that scales by
  role (5 req/min guests, 10 req/min users, 20 req/min admins).
- Centralized JSON error handling — unexpected errors never leak a stack
  trace or fall through to Express's default HTML error page.
- Structured Winston logging to `logs/error.log` / `logs/combined.log` (plus
  console in non-production).
- Graceful shutdown on `SIGTERM`/`SIGINT`: stops accepting new connections,
  closes the database pool, then exits.
- Database-driver switch by environment: the Neon serverless HTTP driver in
  production, plain `node-postgres` against Neon Local in development/test —
  same Drizzle schema and query code either way.

## Getting started

### Prerequisites

- Node.js 20.x and npm
- Docker + Docker Compose, if you want the containerized workflow (recommended)
- A [Neon](https://neon.tech) account and project — either directly (plain local
  run) or via a Neon API key (for the Neon Local Docker workflow)
- An [Arcjet](https://arcjet.com) account and API key

### Environment variables

Copy `.env.example` to `.env` (plain local run) or to `.env.development` /
`.env.production` (Docker Compose) and fill in real values. Never commit a
file with real secrets — everything matching `.env*` except `.env.example` is
gitignored.

| Variable           | Required                              | Default         | Description                                                                                                                                                                                              |
| ------------------ | ------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`         | no                                    | —               | `development`, `production`, or `test`. Selects the database driver, cookie `secure` flag, CORS strictness, and error-message verbosity.                                                                 |
| `PORT`             | no                                    | `3000`          | HTTP port the server listens on.                                                                                                                                                                         |
| `LOG_LEVEL`        | no                                    | `info`          | Winston log level (`debug`, `info`, `warn`, `error`).                                                                                                                                                    |
| `DATABASE_URL`     | yes                                   | —               | Postgres connection string. Points at Neon Local (`postgres://neon:npg@neon-local:5432/neondb?sslmode=require`) in the dev Docker Compose stack, or at real Neon Cloud otherwise.                        |
| `JWT_SECRET`       | **yes**                               | —               | Signing secret for auth tokens. The app refuses to start without it.                                                                                                                                     |
| `JWT_EXPIRES_IN`   | no                                    | `15m`           | JWT lifetime, in [`jsonwebtoken`'s `expiresIn` format](https://github.com/vercel/ms). Kept in sync with the auth cookie's `maxAge`.                                                                      |
| `ARCJET_KEY`       | yes (for Arcjet rules to take effect) | —               | Arcjet API key.                                                                                                                                                                                          |
| `ALLOWED_ORIGINS`  | no                                    | —               | Comma-separated list of allowed CORS origins. Only enforced when `NODE_ENV=production`; unset means no cross-origin browser requests are allowed in production. Ignored (permissive) outside production. |
| `NEON_API_KEY`     | dev Docker only                       | —               | Consumed by the `neon-local` container itself, to authenticate to Neon Cloud and create the ephemeral branch. Not read by the app.                                                                       |
| `NEON_PROJECT_ID`  | dev Docker only                       | —               | Same as above — Neon Local control plane.                                                                                                                                                                |
| `PARENT_BRANCH_ID` | dev Docker only                       | project default | Branch Neon Local's ephemeral branch is created from.                                                                                                                                                    |

### Local development without Docker

Requires a reachable Postgres database (a real Neon Cloud connection string
works fine here too).

```bash
npm install
cp .env.example .env   # then fill in DATABASE_URL, JWT_SECRET, ARCJET_KEY
npm run db:migrate     # applies drizzle/ migrations to DATABASE_URL
npm run dev            # starts with --watch on http://localhost:3000
```

### Local development with Docker (Neon Local)

This is the intended workflow: it runs the app alongside `neon-local`, a proxy
that creates a **fresh ephemeral Neon branch** for the session and deletes it
again when the stack stops — no shared dev database, no manual seeding.

```bash
cp .env.example .env.development
# fill in NEON_API_KEY, NEON_PROJECT_ID, ARCJET_KEY, JWT_SECRET
# DATABASE_URL can stay as the Neon Local default shown in .env.example

docker compose --env-file .env.development -f docker-compose.dev.yml up --build
```

The app container waits for `neon-local`'s health check before starting, then
serves on `http://localhost:3000` with `src/` bind-mounted for hot reload.
Run migrations against the ephemeral branch with:

```bash
docker compose -f docker-compose.dev.yml exec app npm run db:migrate
```

## API reference

All request/response bodies are JSON. All timestamps are ISO 8601.

### Auth — `/api/auth`

| Method | Path        | Auth | Body                               |
| ------ | ----------- | ---- | ---------------------------------- |
| POST   | `/sign-up`  | none | `{ name, email, password, role? }` |
| POST   | `/sign-in`  | none | `{ email, password }`              |
| POST   | `/sign-out` | none | —                                  |

`role` defaults to `"user"`; `password` must be at least 6 characters.

<details>
<summary>POST /api/auth/sign-up</summary>

Request:

```json
{ "name": "Jane Doe", "email": "jane@example.com", "password": "hunter22" }
```

Response `201`, and sets a `token` cookie:

```json
{
  "message": "User created successfully",
  "user": {
    "id": 1,
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "user"
  }
}
```

Errors: `400` (validation), `409` (`{"error":"email already exists"}`).
</details>

<details>
<summary>POST /api/auth/sign-in</summary>

Request:

```json
{ "email": "jane@example.com", "password": "hunter22" }
```

Response `200`, and sets a `token` cookie:

```json
{
  "message": "User signed in successfully",
  "user": {
    "id": 1,
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "user"
  }
}
```

Errors: `400` (validation), `401` (`{"error":"Invalid email or password"}` —
returned identically whether the email doesn't exist or the password is
wrong, so a failed login can't be used to enumerate registered emails).
</details>

<details>
<summary>POST /api/auth/sign-out</summary>

Clears the `token` cookie. Response `200`:

```json
{ "message": "User signed out successfully" }
```

</details>

### Users — `/api/users`

| Method | Path   | Auth                   | Notes                                                       |
| ------ | ------ | ---------------------- | ----------------------------------------------------------- |
| GET    | `/`    | any authenticated user | Lists all users.                                            |
| GET    | `/:id` | any authenticated user | Reads any user by id (not just your own).                   |
| PUT    | `/:id` | self or admin          | Body is a partial update; only an admin may include `role`. |
| DELETE | `/:id` | self or admin          | Deletes the user and returns the deleted record.            |

All routes require a valid `token` cookie (`401 { "error": "Authentication required" }`
otherwise). `PUT`/`DELETE` additionally require the caller to either be the
target user or have `role: "admin"` (`403` otherwise), and reject a `role`
change from a non-admin (`403`) even when updating their own account.

<details>
<summary>GET /api/users</summary>

Response `200`:

```json
{
  "message": "Successfully retrieved users",
  "users": [
    {
      "id": 1,
      "email": "jane@example.com",
      "name": "Jane Doe",
      "role": "user",
      "created_at": "2026-01-01T00:00:00.000Z",
      "updated_at": "2026-01-01T00:00:00.000Z"
    }
  ],
  "count": 1
}
```

</details>

<details>
<summary>GET /api/users/:id</summary>

Response `200`:

```json
{
  "message": "Successfully retrieved user",
  "user": {
    "id": 1,
    "email": "jane@example.com",
    "name": "Jane Doe",
    "role": "user",
    "created_at": "2026-01-01T00:00:00.000Z",
    "updated_at": "2026-01-01T00:00:00.000Z"
  }
}
```

Errors: `400` (malformed id), `404` (`{"error":"User not found"}`).
</details>

<details>
<summary>PUT /api/users/:id</summary>

Request (any subset of these; at least one field required):

```json
{
  "name": "New Name",
  "email": "new@example.com",
  "password": "newpassword",
  "role": "admin"
}
```

Response `200`:

```json
{
  "message": "User updated successfully",
  "user": {
    "id": 1,
    "email": "new@example.com",
    "name": "New Name",
    "role": "admin",
    "created_at": "2026-01-01T00:00:00.000Z",
    "updated_at": "2026-01-02T00:00:00.000Z"
  }
}
```

Errors: `400` (validation), `401` (not authenticated), `403` (not self/admin,
or a non-admin tried to set `role`), `404` (user not found).
</details>

<details>
<summary>DELETE /api/users/:id</summary>

Response `200`:

```json
{
  "message": "User deleted successfully",
  "user": {
    "id": 1,
    "email": "jane@example.com",
    "name": "Jane Doe",
    "role": "user"
  }
}
```

Errors: `401` (not authenticated), `403` (not self/admin), `404` (user not found).
</details>

### Misc

| Method | Path      | Auth | Description                                                        |
| ------ | --------- | ---- | ------------------------------------------------------------------ |
| GET    | `/`       | none | Plain-text hello response.                                         |
| GET    | `/health` | none | `{ status, timestamp, uptime }` — used by the Docker health check. |
| GET    | `/api`    | none | `{ "message": "API is running" }`.                                 |

Any unmatched route returns `404 { "error": "Route not found" }`.

## Database and migrations

The schema is defined once, in code, under `src/models/` (currently just
`user.model.js`) using Drizzle's `pgTable`. Migration SQL files live in
`drizzle/`, generated from that schema — the schema file is the source of
truth, the SQL files are generated artifacts.

```bash
npm run db:generate   # diff src/models/ against drizzle/ and write new migration SQL
npm run db:migrate    # apply pending migrations in drizzle/ to DATABASE_URL
npm run db:studio     # open Drizzle Studio, a GUI browser for the connected database
```

`drizzle.config.js` reads `DATABASE_URL` the same way the app does, so these
commands target whichever database that variable currently points at — the
Neon Local proxy inside the dev Docker stack, or real Neon Cloud.

## Testing

```bash
npm test
```

Runs Jest (native ESM, via `--experimental-vm-modules`) with Supertest for
HTTP-level assertions, and collects coverage on every run.

**Covered:** the auth (`signUpSchema`, `signinSchema`) and users
(`userIdSchema`, `updateUserSchema`) Zod schemas; the JWT sign/verify
round-trip and failure cases in `jwt.js`; both auth middleware functions
(`authenticateToken`'s valid/missing/invalid-token paths, `requireAuth`'s
allow/deny paths); and a base app smoke test (`/health`, `/api`, unmatched
route → `404`).

**Not covered, and worth calling out rather than glossing over:** the
controllers and services (`auth.controller.js`, `users.controller.js`,
`auth.service.js`, `users.services.js`) have no dedicated unit tests, and
there are no database-integration tests — the manual `curl` verification done
while building the users CRUD and auth-gating features was not turned into
automated regression tests. `tests.yml` already runs a real Postgres service
container in CI, so that infrastructure is in place for whoever adds them
next.

## CI/CD

Three GitHub Actions workflows, under `.github/workflows/`:

- **`lint-and-format.yml`** — on push/PR to `main` or `staging`: two parallel
  jobs run `npm run lint` (ESLint) and `npm run format:check` (Prettier) on
  Node 20.x with npm's cache enabled. A failure prints a
  `::error::`-annotated message pointing at `npm run lint:fix` /
  `npm run format`.
- **`tests.yml`** — same triggers: runs `npm test` against a real
  `postgres:16-alpine` service container, with `NODE_ENV=test`,
  `NODE_OPTIONS=--experimental-vm-modules`, `DATABASE_URL`, and `JWT_SECRET`
  all set in the workflow. Publishes a Markdown test/coverage summary to the
  job's step summary, emits `::error::` annotations for any failing test, and
  uploads the coverage report as a 30-day artifact.
- **`docker-build-and-push.yml`** — on push to `main`, or manually via
  `workflow_dispatch`: builds the Dockerfile's `production` target for
  `linux/amd64` and `linux/arm64` with Buildx, using GitHub Actions cache, and
  pushes it to Docker Hub tagged with the branch name, short commit SHA,
  `latest`, and a `prod-YYYYMMDD-HHmmss` timestamp. Requires the
  `DOCKER_USERNAME` / `DOCKER_PASSWORD` repository secrets.

## Deployment notes

`docker-compose.prod.yml` runs only the app container — there is no Neon
Local proxy in production, since `DATABASE_URL` points directly at a real
Neon Cloud connection string. The same Dockerfile and application code are
used in both environments; only environment variables differ.

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

Populate `.env.production` with real values on the deploy host only (it
ships as a placeholder template and is gitignored), or inject them as actual
environment variables — `docker-compose.prod.yml`'s `env_file` is overridden
by real environment variables of the same name if both are present. At
minimum this means a real `DATABASE_URL`, `JWT_SECRET`, and `ARCJET_KEY`; set
`ALLOWED_ORIGINS` too if the API is called from a browser-based frontend.

The image has a Docker `HEALTHCHECK` hitting `GET /health` baked in, and the
app handles `SIGTERM`/`SIGINT` by draining the HTTP server and closing the
database pool before exiting — both matter for zero-downtime deploys and
container orchestrators that rely on health status and graceful termination.

## Project structure

```
.
├── .github/
│   ├── scripts/report-test-results.mjs   # turns jest --json output into a step summary + annotations
│   └── workflows/                        # lint-and-format.yml, tests.yml, docker-build-and-push.yml
├── drizzle/                               # generated SQL migrations + snapshots
├── scripts/                               # dev.sh / prod.sh — Docker Compose convenience wrappers
├── src/
│   ├── config/                            # database.js, arcjet.js, logger.js
│   ├── controllers/                       # request/response handling per route
│   ├── middleware/                        # auth.middleware.js, security.middleware.js, error.middleware.js
│   ├── models/                            # Drizzle table definitions (schema source of truth)
│   ├── routes/                            # Express routers
│   ├── services/                          # database access + business logic
│   ├── utils/                             # cookies.js, jwt.js, format.js
│   ├── validations/                       # Zod schemas
│   ├── app.js                             # Express app: middleware chain + route mounting
│   ├── server.js                          # HTTP server + graceful shutdown
│   └── index.js                           # entry point (loads dotenv, starts server.js)
├── tests/                                 # Jest + Supertest
├── docker-compose.dev.yml                 # app + Neon Local
├── docker-compose.prod.yml                # app only, real Neon Cloud
├── Dockerfile                              # multi-stage: development / production targets
├── drizzle.config.js                      # drizzle-kit configuration
├── jest.config.mjs / jest.setup.mjs       # native-ESM Jest configuration
└── .env.example                           # documented env vars, no real values
```
