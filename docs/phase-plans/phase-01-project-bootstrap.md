# Phase 1: Project Bootstrap

## Background & Goal

The backend needs a small runnable Express foundation before database, auth, users, or domain features.

Phase 1 now stays intentionally simple:

1. Normalize backend package scripts and ES module setup.
2. Create `src/app.js` and `src/server.js`.
3. Load `.env` directly with `dotenv`.
4. Add only `GET /health`.
5. Keep folder structure ready for later phases.

This phase should answer:

> Can the backend start and respond to a basic health request?

---

## Confirmed Decisions

| Topic | Decision |
|---|---|
| Backend root | `backend` |
| Module system | ES modules, using `import` / `export` |
| App entry | `src/server.js` |
| Express app file | `src/app.js` |
| Runtime env file | `backend/.env` |
| Env helper file | No `src/config/env.js` in this project |
| API docs UI | No Swagger UI / `/api-docs` route |
| Health route | `GET /health` |
| Automated tests | Not yet; manual smoke verification only |

---

## Out Of Scope

Do **not** implement these in Phase 1:

- `src/config/env.js` or custom env validation helpers.
- Swagger UI, `swagger.js`, `/api-docs`, `swagger-ui-express`, or `yaml`.
- Database pool or transaction helper.
- Database migrations.
- Auth, users, roles, JWT, or password logic.
- Domain modules such as patients, doctors, appointments, visits, lab, reports, billing.
- Shared error handler.
- `express-validator` request validation middleware.
- Repository or service files.
- Automated Jest/Supertest tests.

These start in later phases only if still needed.

---

## Proposed Changes

### 1. Backend Package Metadata

#### [MODIFY] `backend/package.json`

Purpose:

Make the backend package point to the real source entrypoint and expose clear scripts.

Required shape:

```json
{
  "type": "module",
  "main": "src/server.js",
  "scripts": {
    "dev": "nodemon src/server.js",
    "start": "node src/server.js"
  }
}
```

Phase 1 dependencies:

| Package | Why Phase 1 Needs It |
|---|---|
| `express` | HTTP server framework |
| `cors` | Allow configured frontend origin |
| `dotenv` | Load local env values from `backend/.env` |
| `nodemon` | Local dev restart tool; dev dependency |

Keep already-installed future dependencies like `pg`, `bcrypt`, `jsonwebtoken`, and `express-validator` if they already exist, but do not use them in Phase 1 code.

Remove these from the backend package:

| Package | Why Removed |
|---|---|
| `swagger-ui-express` | No Swagger UI in this project |
| `yaml` | Only needed for parsing OpenAPI for Swagger UI |

---

### 2. Express App

#### [NEW] `backend/src/app.js`

Purpose:

Create and configure the Express app without starting the network listener.

Why this file exists:

- Keeps app setup separate from the server listener.
- Lets future tests import `app` without opening a port.
- Keeps `server.js` focused only on listening.

Expected export:

```js
export const app = express();
```

Responsibilities:

- Import `dotenv` and load `backend/.env`.
- Create the Express app.
- Configure CORS.
- Configure JSON request body parsing.
- Register `GET /health`.

Expected implementation shape:

```js
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';

dotenv.config({ quiet: true });

export const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'hms-backend',
  });
});
```

Routes:

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Confirms the app process is running |

Do not mount `/api/v1` routes in Phase 1.

---

### 3. Server Entrypoint

#### [NEW] `backend/src/server.js`

Purpose:

Start the HTTP server.

Responsibilities:

- Import `app`.
- Read `PORT` directly from `process.env`.
- Fall back to `3000`.
- Call `app.listen(port, callback)`.
- Log the selected port.

Expected shape:

```js
import { app } from './app.js';

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log(`HMS backend listening on port ${port}`);
});
```

Do not put middleware, route definitions, database code, or business logic in `server.js`.

---

### 4. Folder Structure

#### [CREATE] `backend/src/` folders

Create the structure now so later phases have predictable locations:

```text
backend/src/
  db/
  shared/
    constants/
    errors/
    middleware/
    utils/
  modules/
    auth/
    users/
    patients/
    doctors/
    appointments/
    visits/
    lab/
    reports/
    billing/
  policies/
```

Important:

Only create folders. Do not add placeholder domain files in Phase 1.

---

## File Summary

| File | Action | Complexity | Notes |
|---|---|---:|---|
| `backend/package.json` | Modify | Light | scripts, entrypoint, dependency cleanup |
| `backend/package-lock.json` | Modify | Light | remove Swagger packages |
| `backend/src/app.js` | New | Light | dotenv, middleware, health route |
| `backend/src/server.js` | New | Light | starts server |
| `backend/src/...` folders | New | Light | structure only |

---

## Flow Breakdown

### Startup Flow

```text
npm run dev
  -> nodemon src/server.js
  -> server.js imports app.js
  -> app.js loads backend/.env
  -> app.js configures middleware/routes
  -> server.js reads PORT or falls back to 3000
  -> server.js listens on selected port
```

### Request Flow: Health

```text
GET /health
  -> Express app
  -> CORS middleware
  -> JSON middleware
  -> health route
  -> 200 { status: "ok", service: "hms-backend" }
```

---

## Verification Plan

### 1. Static Checks

Run from `backend`:

```powershell
node --check src/app.js
node --check src/server.js
```

Expected:

- No syntax errors.

### 2. Runtime Smoke Check

Run from `backend`:

```powershell
npm run dev
```

Then open:

```http
GET http://localhost:3000/health
```

Expected:

- `/health` returns HTTP `200`.
- Startup does not require database or JWT env values.
- `/api-docs` does not exist.

### 3. Boundary Check

Search `backend/src` and confirm Phase 1 did **not** add:

- `src/config/env.js`.
- `src/docs/swagger.js`.
- `/api-docs`.
- `DATABASE_URL` usage.
- JWT usage.
- bcrypt usage.
- repositories.
- services.
- domain routes.
- database pool or transaction helper.

---

## Acceptance Criteria

Phase 1 is complete when:

- `npm run dev` starts the backend from `backend`.
- `GET /health` works.
- No Swagger UI route or Swagger packages exist.
- No custom env helper file exists.
- `app.js` and `server.js` have separate responsibilities.
- No database/auth/domain implementation exists yet.
