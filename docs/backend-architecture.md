# Backend Architecture

## Decision Summary

The MVP backend will use:

- Node.js
- Express.js
- JavaScript
- ES modules
- PostgreSQL
- Raw SQL through `pg`
- Repository pattern
- `express-validator` for request validation
- Manual SQL migration files
- Contract-first OpenAPI file for API design

We are not using TypeScript or an ORM in the MVP. This keeps setup smaller and helps us learn SQL, transactions, and backend layering deeply.

The backend project root is:

```text
backend
```

Because `backend/package.json` uses `"type": "module"`, implementation files should use `import` and `export`.

## Request Flow

```text
HTTP request
  -> route
  -> middleware
  -> validator
  -> controller
  -> service
  -> repository
  -> PostgreSQL via pg
```

Each layer has one job. When a layer starts doing too much, the code becomes harder to test and harder to safely change.

## Folder Structure

```text
backend/
  package.json
  src/
    app.js
    server.js

    db/
      pool.js
      transaction.js

    shared/
      constants/
      errors/
        AppError.js
        errorCodes.js
      middleware/
        authenticate.js
        authorizeRole.js
        errorHandler.js
        validateRequest.js
      utils/
        asyncHandler.js
        password.js
        token.js

    modules/
      auth/
        auth.routes.js
        auth.controller.js
        auth.service.js
        auth.repository.js
        auth.validators.js

      users/
        users.routes.js
        users.controller.js
        users.service.js
        users.repository.js
        users.validators.js

      patients/
      doctors/
      appointments/
      visits/
      lab/
      reports/
      billing/

    policies/
      patientAccessPolicy.js
      doctorAccessPolicy.js
```

## Layer Responsibilities

| Layer | Owns | Must not own |
|---|---|---|
| Routes | URL shape, middleware order, controller binding | Business rules or SQL |
| Middleware | Cross-cutting request behavior | Module-specific business decisions |
| Validators | Request body/query/params validation | Database reads or writes |
| Controllers | HTTP input/output mapping | Business workflows or SQL |
| Services | Business rules, orchestration, transactions | Raw SQL strings |
| Repositories | SQL queries and row mapping | HTTP behavior or business decisions |
| Policies | Ownership and permission checks | Controller response formatting |
| DB helpers | Pool and transaction safety | Module-specific query knowledge |

## Raw SQL Rules

- Always use parameterized queries: `$1`, `$2`, `$3`.
- Never build SQL with untrusted string interpolation.
- Keep SQL inside repository files.
- Keep repository methods small and intention-revealing.
- Return `null` when a single-row lookup finds nothing.
- Return arrays for list queries.
- Map database snake_case fields to API-friendly camelCase before returning from service/controller layers.
- Add indexes for frequent filters before performance becomes painful.

Example repository method:

```js
async function findUserByEmail(db, email) {
  const result = await db.query(
    `
    SELECT id, email, password_hash, role, status
    FROM users
    WHERE email = $1
      AND deleted_at IS NULL
    LIMIT 1
    `,
    [email]
  );

  return result.rows[0] || null;
}
```

The first argument is named `db` on purpose. It can be either:

- the shared pool for simple single-query operations
- a transaction client for multi-query workflows

That keeps repositories reusable inside and outside transactions.

## Validation Pattern

Use `express-validator` for runtime request validation.

Validation chains should live in each module's `*.validators.js` file, not inside controllers. Routes attach validators before controllers, and a shared `validateRequest` middleware converts validation failures into the standard API error response.

Expected route shape:

```js
router.post(
  '/auth/login',
  loginValidators,
  validateRequest,
  authController.login
);
```

Why this pattern:

- Routes show the request pipeline clearly.
- Controllers stay focused on HTTP input/output.
- Validation logic remains easy to find per module.
- The shared middleware keeps error response formatting consistent.

Tradeoff:

`express-validator` is route-friendly, but it does not create strong reusable schema objects like Zod. To keep the code maintainable, avoid inline one-off validators inside route files once a module grows beyond a trivial endpoint.

## Migration Strategy

Schema changes use manual SQL files for MVP.

Recommended future folder:

```text
db/migrations/
```

Recommended naming:

```text
001_initial_schema.sql
002_add_refresh_sessions_indexes.sql
```

Rules:

- Migration files must be ordered and committed.
- SQL must be reviewable and executable against a fresh database.
- Do not edit an already-applied migration casually; add a new migration that changes the schema forward.
- Rollback files are optional during MVP, but every migration should be written with rollback thinking in mind.

## Transaction Pattern

`db/pool.js` owns the PostgreSQL pool.

`db/transaction.js` owns the reusable transaction wrapper:

```js
async function withTransaction(work) {
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

Use transactions for workflows where partial success would corrupt business state:

- appointment booking conflict check plus insert
- visit start
- visit completion plus appointment completion plus invoice creation
- lab order creation from assigned tests
- report upload plus assigned test completion
- payment capture plus invoice status update

Service example:

```js
async function completeVisit(visitId, doctorUserId) {
  return withTransaction(async (db) => {
    const visit = await visitRepository.completeVisit(db, visitId, doctorUserId);
    const invoice = await invoiceRepository.createForVisit(db, visit);

    return { visit, invoice };
  });
}
```

Important rule:

Inside a transaction workflow, every repository call must use the transaction client passed as `db`. Do not call `pool.query()` from inside that workflow, because that would run outside the transaction.

## Error Handling

Services should throw application errors when business rules fail:

- invalid credentials
- inactive account
- forbidden role
- ownership mismatch
- appointment slot unavailable
- completed visit is immutable
- invoice payment exceeds due amount

Controllers should not manually build many different error responses. They should let `errorHandler.js` convert application errors into the standard API error shape.

## Testing Strategy

Phase 0 starts with manual verification because no application module exists yet. After the first real module slice is built, introduce automated tests with `jest` and `supertest`.

Unit tests should focus on services:

- service calls the right repositories
- service handles missing data
- service enforces business rules
- service uses transactions for critical writes

Integration tests should focus on API behavior:

- validation errors
- authentication failures
- authorization failures
- successful request/response shape
- database state after important workflows

Raw SQL means we should be especially careful with integration tests around appointment conflicts, visit completion, reports, invoices, and payments.

## Tradeoffs

Raw SQL gives us:

- clear visibility into the database
- strong SQL learning
- precise control over queries and indexes
- less abstraction during MVP setup

Raw SQL costs us:

- more manual query writing
- more responsibility for mapping rows to API shapes
- no ORM-level relationship helpers
- higher risk if SQL leaks into services/controllers

The repository pattern is the discipline that keeps this choice maintainable.
