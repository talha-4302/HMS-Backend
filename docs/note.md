# Study Notes / Revisit Later

This file tracks topics we moved through before fully mastering them. These are not blockers for progress, but they should be revisited deliberately so the project does not become "code we copied but cannot explain."

## 1. Shared API Foundation: Deep Understanding Required

Status:

- Phase 3 implementation exists or is in progress.
- Need deeper study before treating this layer as fully understood.

Files to study:

- `backend/src/shared/errors/AppError.js`
- `backend/src/shared/errors/errorCodes.js`
- `backend/src/shared/middleware/validateRequest.js`
- `backend/src/shared/middleware/notFoundHandler.js`
- `backend/src/shared/middleware/errorHandler.js`
- `backend/src/app.js`

Questions to answer:

- What problem does `AppError` solve compared to throwing a normal `Error`?
- Why do we need `statusCode`, `code`, `message`, `details`, and `isOperational`?
- How does `errorCodes.js` help keep API responses consistent?
- How does `validateRequest` read errors from `express-validator`?
- Why does `validateRequest` call `next(error)` instead of sending the response directly?
- Why does `notFoundHandler` sit after all real routes?
- Why must `errorHandler` be the last middleware?
- How does Express know `errorHandler` is an error middleware?
- What is the request flow for:
  - successful `/health`
  - unknown route
  - validation failure
  - expected application error
  - unexpected programming error
- Why should controllers avoid manually formatting error responses?

Flow to understand:

```text
Request
  -> normal middleware
  -> route / validator
  -> if validation fails: validateRequest creates AppError
  -> if route does not exist: notFoundHandler creates AppError
  -> errorHandler sends final JSON response
```

Production reasoning:

- Centralized error formatting keeps frontend behavior predictable.
- Expected errors should be safe and structured.
- Unexpected errors should not leak stack traces, SQL details, file paths, or secrets.
- Shared middleware keeps controllers thin and focused on HTTP input/output.

Study target:

Be able to explain each shared module line by line and draw the full request/error flow without looking at the code.

## 2. Database Migration SQL: Deep Understanding Required

Status:

- Initial migration file exists:
  - `db/migrations/001_initial_schema.sql`
- Need deeper study before applying more schema changes confidently.

Files to study:

- `db/migrations/001_initial_schema.sql`
- `db/schema.md`
- `backend/src/db/pool.js`
- `backend/src/db/transaction.js`

Questions to answer:

- What is a database migration?
- Why do we keep migration SQL files instead of manually creating tables from memory?
- Why is `001_initial_schema.sql` the executable schema source?
- Why should already-applied migrations not be casually edited?
- What is the difference between schema design documentation and migration SQL?
- Why do we use `CREATE EXTENSION`?
- Why do we use PostgreSQL enums for roles/statuses?
- What does each table represent in the healthcare domain?
- Why do tables use UUID primary keys?
- Why do we need foreign keys?
- What does `ON DELETE CASCADE` do, and where is it safe or risky?
- Why do we add indexes?
- Which queries are each index likely supporting?
- What are `CHECK` constraints doing?
- Why does the migration avoid seed data?
- Why should migrations use `MIGRATION_DATABASE_URL` instead of the normal app connection URL?
- Why should the app use `NEON_DATABASE_URL` for runtime queries?
- How does this schema support Phase 4 auth?

Schema areas to study:

- Extensions:
  - `pgcrypto`
  - `btree_gist`
- Enums:
  - user roles/statuses
  - appointment/visit/lab/report/invoice/payment statuses
- Identity:
  - `users`
  - `refresh_sessions`
  - `audit_logs`
- Profiles:
  - `patient_profiles`
  - `doctor_profiles`
  - `staff_profiles`
- Scheduling:
  - `doctor_unavailability`
  - `appointments`
- Clinical:
  - `visits`
  - `visit_assigned_tests`
- Lab/reports:
  - `test_catalog`
  - `lab_orders`
  - `lab_order_items`
  - `lab_reports`
  - `patient_reports`
  - `report_attachments`
- Billing:
  - `invoices`
  - `invoice_items`
  - `payments`
- Indexes:
  - lookup indexes
  - filtering indexes
  - relationship indexes

Production reasoning:

- Migration files make schema changes reviewable, repeatable, and shareable.
- Constraints protect data even if application code has a bug.
- Foreign keys preserve relational integrity.
- Indexes prepare common lookups and filters for acceptable performance.
- Separating runtime DB access from migration DB access keeps operational intent clear.

Study target:

Be able to explain why every table, enum, foreign key, constraint, and index exists, and how the migration prepares the database for the next implementation phases.
