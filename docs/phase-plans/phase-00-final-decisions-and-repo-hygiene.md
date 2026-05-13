# Phase 0: Final Decisions and Repo Hygiene

## Goal

Phase 0 prepares the project for implementation without writing backend feature code.

The outcome is a clear set of technical decisions and repo conventions so Phase 1 can start cleanly.

## Workflow

Phase 0 follows our standard learning/building loop:

```text
Brainstorm
  -> Planning
  -> Detailed phased planning
  -> Implement
  -> Review
  -> Change/study gaps
```

For Phase 0, "implement" means updating documentation and small repo metadata. It does not mean building application modules yet.

## Dependencies

Phase 0 depends on the existing planning docs:

- `docs/guidance.md`
- `docs/backend-architecture.md`
- `docs/implementation-plan.md`
- `docs/mvp-feature-breakdown.md`
- `docs/mvp-api-contract.md`
- `docs/openapi-guidance.md`
- `docs/openapi.yaml`
- `db/schema.md`

## Scope

Phase 0 includes:

- Confirm validation library choice.
- Confirm migration strategy.
- Confirm test database strategy.
- Confirm environment variable naming convention.
- Confirm local development ports.
- Confirm package/dependency list for Phase 1.
- Confirm Git tracking for docs and database files.
- Identify missing or inconsistent planning docs.
- Record study gaps before implementation starts.

## Out of Scope

Phase 0 does not include:

- Creating the Express app.
- Installing dependencies.
- Writing API controllers.
- Writing repositories.
- Creating database migrations.
- Implementing authentication.
- Expanding the full OpenAPI spec.

Those belong to later implementation phases.

## Final Decisions

| Area | Decision |
|---|---|
| Language | JavaScript |
| Module system | ES modules |
| Backend framework | Express.js |
| Database | PostgreSQL |
| Hosted database target | Neon PostgreSQL |
| Database access | Raw SQL with `pg` |
| Query organization | Repository pattern |
| Transaction pattern | Shared `withTransaction` helper |
| API docs | OpenAPI 3.1.1 contract file only |
| Validation library | `express-validator` |
| Migration strategy | Manual SQL migration files |
| Password hashing | `bcrypt` |
| JWT library | `jsonwebtoken` |
| Env loading | `dotenv` |
| Test framework | `jest` + `supertest`, introduced after the first module slice |
| CORS | `cors` |
| UUID | native `crypto.randomUUID()` |

### What ES Modules Means

ES modules are the Node.js module format that uses `import` and `export`.

Example:

```js
import express from 'express';

export default app;
```

For this MVP, ES modules match the existing `backend/package.json` setting:

```json
{
  "type": "module"
}
```

That means implementation files should use ES module syntax consistently.

## 1. Validation Library

Decision:

Use `express-validator`.

Reason:

`express-validator` is simple to learn in an Express project because validators attach directly to route pipelines. It is a good fit while we are focusing on request validation mechanics, middleware order, and production error responses.

Tradeoff:

Unlike Zod, it does not naturally produce reusable schema objects or OpenAPI schemas. To avoid scattered validation, each module should keep validation chains in `*.validators.js` files and route files should only attach those chains.

Future pattern:

```text
route
  -> module validator chains
  -> validateRequest middleware
  -> controller
```

## 2. Migration Strategy

Decision:

Use manual SQL migration files.

Reason:

The project already chooses raw SQL with `pg`, so manual SQL migrations support the learning goal: you will see exactly how schema changes are written, ordered, reviewed, and applied.

Tradeoff:

Manual migrations require discipline. There is no runner tracking what has already been applied, so we must keep filenames ordered and document how to apply them. If this becomes painful, we can add a migration runner later without changing the overall SQL-first architecture.

Future convention:

```text
db/migrations/
  001_initial_schema.sql
  002_add_indexes_for_appointments.sql
```

MVP rule:

- Use forward migrations.
- Do not edit a migration after it has been applied to a shared or hosted database unless the team explicitly agrees.
- Think about rollback before writing the migration, even if rollback files are not created yet.

## 3. Test Database Strategy

Decision:

Do not force automated testing before any real module exists. Start with manual verification for Phase 0 and early bootstrap. After the first module slice is built, introduce automated tests using `jest` and `supertest`.

Reason:

Testing will make more sense once there is behavior to test. Starting tests after the first module lets us learn testing with concrete code instead of abstract setup.

Production note:

This is not a decision to skip testing for the project. It is a sequencing decision. Once module behavior exists, automated tests should become part of each implementation phase.

Future strategy:

- Unit tests mock repositories when testing service rules.
- API integration tests use `supertest`.
- Database integration tests use `TEST_DATABASE_URL`.
- Test cleanup strategy will be finalized when the first integration tests are introduced.

## 4. Environment Variables

Decision:

Use the following environment variable names:

```text
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://USER:PASSWORD@HOST/hms_db?sslmode=require&channel_binding=require
MIGRATION_DATABASE_URL=postgresql://USER:PASSWORD@DIRECT_HOST/hms_db?sslmode=require&channel_binding=require
TEST_DATABASE_URL=postgresql://USER:PASSWORD@HOST/hms_test?sslmode=require&channel_binding=require
JWT_ACCESS_SECRET=replace-with-long-random-access-secret
JWT_REFRESH_SECRET=replace-with-long-random-refresh-secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_SALT_ROUNDS=12
CORS_ORIGIN=http://localhost:5173
```

Rules:

- `backend/.env` is local and ignored by Git.
- Root `.env.example` is committed as the safe template.
- `.env.example` must contain placeholders only.
- `DATABASE_URL` is the application runtime connection and may use a pooled Neon URL.
- `MIGRATION_DATABASE_URL` is the direct Neon connection used for manual schema setup and migrations.
- `TEST_DATABASE_URL` is reserved for automated integration tests after the first testable module exists.
- Secrets must never be hardcoded in source files.
- Real Neon database URLs must never be committed in docs, source, examples, tests, or screenshots.
- App startup should fail fast if required variables are missing.

Security note:

A real-looking Neon connection string was present in the draft phase notes. It has been removed from the committed phase plan. If that credential is live, rotate it in Neon before relying on it.

## 5. Local Development Ports

Decision:

| Service | Port |
|---|---:|
| Backend API | 3000 |
| Runtime API docs UI | Not included |
| Future frontend | 5173 |
| PostgreSQL, when local | 5432 |

Neon does not require a local PostgreSQL port, but keeping `5432` as the local convention helps if we later run PostgreSQL locally for tests or offline development.

## 6. Dependency List For Phase 1

Runtime dependencies:

- `express`
- `dotenv`
- `cors`
- `pg`
- `jsonwebtoken`
- `bcrypt`
- `express-validator`

Development dependencies:

- `jest`
- `supertest`
- `nodemon`

Migration dependency:

- None for Phase 1.

Reason:

Manual SQL migrations do not require a migration runner package yet.

## Files Created Or Modified

Phase 0 documentation and metadata edits:

- `docs/guidance.md`
- `docs/backend-architecture.md`
- `docs/implementation-plan.md`
- `docs/mvp-api-contract.md`
- `docs/openapi-guidance.md`
- `docs/phase-plans/phase-00-final-decisions-and-repo-hygiene.md`
- `.gitignore`
- `.env.example`

No backend source files were created in Phase 0.

## API Contracts Covered

No API endpoint is implemented in Phase 0.

Phase 0 only protects future API work by finalizing:

- validation strategy
- migration strategy
- test strategy
- environment strategy
- repo tracking strategy

## Database Tables Used

No database table is used directly in Phase 0.

Phase 0 references all schema tables only for planning.

## Service Design

No service implementation in Phase 0.

Service design rule confirmed:

- services own business workflows
- services call repositories
- services own transaction boundaries
- services throw application errors for business failures

## Repository Design

No repository implementation in Phase 0.

Repository design rule confirmed:

```js
async function repositoryMethod(db, input) {
  const result = await db.query('...', [input]);
  return result.rows;
}
```

Repository methods must accept `db` so they work with either:

- the shared pool
- a transaction client

## Validation Rules

No endpoint validation rules are implemented in Phase 0.

Future validation rules:

- Use `express-validator`.
- Keep chains in module-level `*.validators.js` files.
- Use shared `validateRequest` middleware for consistent validation errors.
- Keep OpenAPI request schemas aligned with validators during endpoint implementation.

Expected future pattern:

```text
route
  -> module validator chains
  -> validateRequest
  -> controller
```

## Authorization And Ownership Rules

No authorization implementation in Phase 0.

Phase 0 confirms these rules remain baseline:

- authentication verifies identity
- role authorization checks role-level permission
- ownership policies check data-level access
- doctors do not automatically access every patient
- patients use `/me` routes where possible
- admin behavior uses normal resources with admin authorization

## Transaction Requirements

No transaction code is written in Phase 0.

Phase 0 confirms the project will use:

```text
db/transaction.js
```

for:

- appointment booking
- visit start
- visit completion plus invoice creation
- lab order creation
- report upload plus assigned test completion
- payment capture plus invoice update

## Test Plan

Phase 0 does not require automated tests because it only updates docs and repo metadata.

Phase 0 review checks:

- all Phase 0 decisions are documented
- no stale validation or migration decisions remain deferred
- no stale ORM assumptions remain
- TypeScript is mentioned only as a non-MVP choice
- docs are not ignored by Git
- db planning files are not ignored by Git
- `backend/.env` is ignored
- `.env.example` is available with placeholders only
- master plan and phase plan locations are clear

## Manual Verification

Manual checks:

- Confirm `docs/` is not ignored.
- Confirm `db/` is not ignored.
- Confirm `backend/.env` is ignored.
- Confirm `.env.example` is trackable.
- Confirm current docs agree on raw SQL with `pg`.
- Confirm OpenAPI docs still point to `docs/openapi.yaml`.
- Confirm no committed doc includes the real Neon password.

## Risks And Tradeoffs

Risk:

`express-validator` can become scattered across routes.

Mitigation:

Keep validators in module-level `*.validators.js` files and use a shared `validateRequest` middleware.

Risk:

Manual migrations can create database drift.

Mitigation:

Use ordered SQL files, document application steps, and add a migration runner later if manual tracking becomes unreliable.

Risk:

Deferring automated tests for the first slice can make it easy to keep deferring them.

Mitigation:

Phase plans after the first runnable module should include explicit test expectations. Once module behavior exists, tests become part of normal implementation.

Risk:

Raw SQL increases responsibility for safe query patterns.

Mitigation:

Use repository pattern, parameterized queries, transaction helper, and integration tests once the database layer exists.

## Study Gaps

Phase 0 study topics:

- ES module `import/export`
- `express-validator` validation chains
- shared validation error formatting
- SQL migrations and migration runners
- PostgreSQL test database setup
- `.env` vs `.env.example`
- dependency categories: runtime vs dev
- why docs and schema should be version-controlled

## Exit Criteria

Phase 0 is complete when:

- validation library is chosen
- migration strategy is chosen
- test database strategy is chosen
- environment variable list is finalized
- Phase 1 dependency list is finalized
- repo hygiene is confirmed
- `docs/implementation-plan.md` exists
- Phase 1 can start without unresolved setup decisions
