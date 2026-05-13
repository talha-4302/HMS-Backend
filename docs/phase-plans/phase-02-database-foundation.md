# Phase 2: Database Foundation

## Background & Goal

The backend now has a small runnable Express foundation. Before building auth, users, appointments, visits, billing, or reports, the project needs a safe PostgreSQL foundation.

Phase 2 stays focused on infrastructure:

1. Add a shared PostgreSQL pool using `pg`.
2. Add a reusable transaction helper.
3. Create the first manual SQL migration.
4. Verify database connectivity with a simple query.
5. Keep all domain repositories, services, controllers, and routes out of this phase.

This phase should answer:

> Can the backend connect to PostgreSQL and safely run transaction-bound database work?

---

## Confirmed Decisions

| Topic | Decision |
|---|---|
| Backend root | `backend` |
| Module system | ES modules, using `import` / `export` |
| Database | PostgreSQL on Neon |
| Database client | Raw SQL with `pg` |
| App database env | `NEON_DATABASE_URL` |
| Migration database env | `MIGRATION_DATABASE_URL` |
| Test database env | `TEST_DATABASE_URL`, documented for later only |
| Runtime env file | `backend/.env` |
| Env helper file | No `src/config/env.js` in this project |
| Migration style | Manual SQL files |
| First migration | `db/migrations/001_initial_schema.sql` |
| Public DB health endpoint | Not in Phase 2 |

Important:

Because this project does not use a central env helper, database infrastructure should read required env vars directly where they are needed.

---

## Out Of Scope

Do **not** implement these in Phase 2:

- `src/config/env.js` or a central env helper.
- Public database health endpoint.
- Domain repositories.
- Domain services.
- Domain controllers or routes.
- Auth, JWT, password hashing, sessions, or RBAC behavior.
- Seed data.
- Automated Jest/Supertest tests.
- Test database cleanup strategy.
- Any SQL access helpers for users, patients, doctors, appointments, visits, lab, reports, or billing.
- Swagger UI, `/api-docs`, or runtime OpenAPI serving.

These belong to later phases.

---

## Proposed Changes

### 1. PostgreSQL Pool

#### [NEW] `backend/src/db/pool.js`

Purpose:

Create one shared PostgreSQL connection pool for normal app database queries.

Why this file exists:

- Keeps database connection setup in one place.
- Avoids creating a new connection for every query.
- Gives future repositories one shared database interface.
- Keeps app startup independent from database connection checks unless database code is actually used.

Responsibilities:

- Import `dotenv` and load `backend/.env`.
- Import `Pool` from `pg`.
- Read `process.env.NEON_DATABASE_URL` directly.
- Throw a clear error if `NEON_DATABASE_URL` is missing.
- Export the shared pool.

Expected implementation shape:

```js
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ quiet: true });

const { Pool } = pg;

const connectionString = process.env.NEON_DATABASE_URL;

if (!connectionString) {
  throw new Error('NEON_DATABASE_URL is required to initialize the database pool');
}

export const pool = new Pool({
  connectionString,
});
```

Production logic:

- The pool should fail loudly when database code runs without a database URL.
- Do not hide connection errors with fallback values.
- Do not read `MIGRATION_DATABASE_URL` here. The running app uses `NEON_DATABASE_URL`.

---

### 2. Transaction Helper

#### [NEW] `backend/src/db/transaction.js`

Purpose:

Provide one safe transaction wrapper for future service-layer workflows.

Why this file exists:

- Multi-table workflows must commit or roll back as one unit.
- Services should not duplicate `BEGIN` / `COMMIT` / `ROLLBACK` logic.
- Future repositories can accept either the pool or a transaction client through the same `db.query(...)` interface.

Expected export:

```js
export async function withTransaction(work) {
  // connect, BEGIN, run work(client), COMMIT/ROLLBACK, release
}
```

Required behavior:

1. Get a client from `pool.connect()`.
2. Run `BEGIN`.
3. Await `work(client)`.
4. Run `COMMIT` when `work` succeeds.
5. Run `ROLLBACK` when `work` throws.
6. Always release the client in `finally`.
7. Re-throw the original error after rollback.

Expected implementation shape:

```js
import { pool } from './pool.js';

export async function withTransaction(work) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

Later service rule:

Inside `withTransaction`, every repository call must use the transaction client passed as `db`.

```js
await withTransaction(async (db) => {
  await appointmentRepository.create(db, appointmentInput);
  await auditRepository.create(db, auditInput);
});
```

Do not import the pool directly inside a repository method that needs to participate in a transaction.

---

### 3. Initial SQL Migration

#### [NEW] `db/migrations/001_initial_schema.sql`

Purpose:

Turn the current database schema design into an executable SQL migration.

Why this file exists:

- `db/schema.md` explains the schema.
- `db/migrations/001_initial_schema.sql` creates the schema.
- Future schema changes should be represented by new migration files, not by editing old applied migrations casually.

Source:

Use the current SQL from `db/schema.md` as the basis for this first migration.

Expected contents:

- enums
- `users`
- `refresh_sessions`
- `patient_profiles`
- `doctor_profiles`
- `staff_profiles`
- `appointments`
- `visits`
- `test_catalog`
- `visit_assigned_tests`
- `lab_orders`
- `lab_order_items`
- `lab_reports`
- `patient_reports`
- `report_attachments`
- `invoices`
- `invoice_items`
- `payments`
- indexes

Do not insert seed data in this migration.

---

### 4. Manual Database Check

#### [ADD] Simple documented check from `backend`

Purpose:

Verify the app can connect to the database before domain modules depend on it.

Preferred check:

```sql
SELECT 1;
```

Why this is enough:

- It verifies connection, authentication, network access, and SSL settings.
- It does not require domain tables.
- It does not leave rows behind.

Acceptable forms:

- A temporary one-line Node command documented in this phase plan.
- A small local check script if we decide the repeatability is worth it.

Keep the first implementation simple unless we have a strong reason to add a permanent script.

Phase 2 implementation uses repeatable package scripts:

```powershell
npm run db:check
npm run db:check:transaction
```

---

## File Summary

| File | Action | Complexity | Notes |
|---|---|---:|---|
| `backend/src/db/pool.js` | New | Light | shared `pg` pool, direct `NEON_DATABASE_URL` read |
| `backend/src/db/transaction.js` | New | Light | reusable transaction wrapper |
| `backend/scripts/check-db-connection.js` | New | Light | repeatable `SELECT 1` connectivity check |
| `backend/scripts/check-db-transaction.js` | New | Light | repeatable transaction lifecycle check |
| `db/migrations/001_initial_schema.sql` | New | Medium | executable initial schema |
| `backend/.env` | Local only | Light | real local database URLs, never committed |
| `.env.example` | Modify if needed | Light | placeholders for database env names only |

---

## Repository Contract For Later Phases

No domain repository is implemented in Phase 2.

Phase 2 only defines the future repository convention:

```js
export async function findUserById(db, userId) {
  const result = await db.query(
    'SELECT * FROM users WHERE id = $1',
    [userId],
  );

  return result.rows[0] ?? null;
}
```

Rules:

- The first argument should be named `db`.
- `db` can be either the shared pool or a transaction client.
- All SQL must use parameterized queries.
- Never concatenate untrusted input into SQL strings.

---

## Flow Breakdown

### App Query Flow

```text
future service/repository
  -> imports pool or receives db
  -> db.query(sql, params)
  -> pg pool opens/reuses a PostgreSQL connection
  -> PostgreSQL returns rows
```

### Transaction Flow

```text
service calls withTransaction(work)
  -> transaction.js gets client from pool
  -> BEGIN
  -> work(client)
  -> if success: COMMIT
  -> if failure: ROLLBACK
  -> release client
  -> return result or re-throw error
```

### Manual Migration Flow

```text
developer uses MIGRATION_DATABASE_URL
  -> connects with direct Neon database URL
  -> runs db/migrations/001_initial_schema.sql
  -> schema objects are created
  -> backend later connects with NEON_DATABASE_URL
```

Why separate URLs:

- `NEON_DATABASE_URL` may use the pooled Neon app connection.
- `MIGRATION_DATABASE_URL` should use the direct Neon connection.
- Schema setup should not depend on PgBouncer transaction pooling behavior.

---

## Verification Plan

### 1. Static Checks

Run from `backend`:

```powershell
node --check src/db/pool.js
node --check src/db/transaction.js
```

Expected:

- No syntax errors.

### 2. Package Check

Run from `backend`:

```powershell
npm ls pg
```

Expected:

- `pg` is installed and available to the backend package.

### 3. Migration Check

Use the direct migration database URL.

Expected:

- `db/migrations/001_initial_schema.sql` applies successfully to an empty database.
- No seed data is inserted.
- No real patient data appears anywhere.

### 4. Connectivity Check

Run a simple database query from `backend` using `NEON_DATABASE_URL`:

```sql
SELECT 1;
```

Expected:

- Query returns successfully.
- Missing or invalid `NEON_DATABASE_URL` fails clearly.

### 5. Transaction Check

Manual verification should cover:

- `withTransaction` commits successful work.
- `withTransaction` rolls back failed work.
- The transaction client is released after success.
- The transaction client is released after failure.
- The original error is re-thrown after rollback.

Use temporary rollback-only statements if table writes are needed for verification.

### 6. Boundary Check

Search the backend and confirm Phase 2 did **not** add:

- domain repositories.
- domain services.
- domain controllers.
- domain routes.
- seed scripts.
- public database health endpoint.
- `src/config/env.js`.
- `/api-docs`.

---

## Security & Production Notes

Security:

- Never commit real database URLs.
- Keep real values only in local `backend/.env`.
- Use parameterized SQL for every future query.
- Do not expose database connectivity details through public API responses.

Reliability:

- Transaction code must always release the client.
- Rollback should not swallow the original application error.
- Database URL validation should happen when database infrastructure is used, not during plain `/health` startup.

Scalability:

- The pool allows connection reuse instead of opening one connection per query.
- Pool sizing can stay default in Phase 2 and be tuned later when load characteristics are known.
- Future multi-table writes should use `withTransaction` to avoid partial state.

---

## Study Gaps

Phase 2 learning topics:

- `pg.Pool` vs `pg.Client`.
- Why PostgreSQL transactions must use the same client.
- Neon pooled URL vs direct URL.
- Why migrations should use a direct database connection.
- Manual SQL migration discipline.
- `BEGIN`, `COMMIT`, `ROLLBACK`, and `release`.
- Parameterized queries and SQL injection prevention.

---

## Acceptance Criteria

Phase 2 is complete when:

- `backend/src/db/pool.js` exists.
- `backend/src/db/transaction.js` exists.
- `pool.js` reads `NEON_DATABASE_URL` directly and fails clearly when it is missing.
- `withTransaction(work)` handles commit, rollback, release, return values, and error propagation.
- `db/migrations/001_initial_schema.sql` exists and can build the initial schema.
- A valid database connection can run `SELECT 1`.
- Manual transaction commit and rollback checks pass.
- `GET /health` still does not require a database connection.
- No domain repositories, services, controllers, routes, seed data, auth behavior, or public DB health endpoint are added.
