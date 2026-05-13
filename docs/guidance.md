# HMS Development Guidance

## 1. Working Principle

We are building this HMS as a production-grade project, not just a demo.

That means we should move through the development lifecycle deliberately:

1. Understand the domain.
2. Freeze MVP scope.
3. Define API contracts.
4. Design backend architecture.
5. Create a phase implementation plan.
6. Write focused tests.
7. Implement in small reviewable sessions.
8. Refactor only when the code shows real duplication or complexity.

The goal is to learn deeply while building something maintainable.

---

## 2. Backend Stack Decision

We will use:

- Node.js
- Express.js
- PostgreSQL

Current supporting tool decisions for MVP are:

- Validation library: `express-validator`.
- Authentication/JWT library: `jsonwebtoken`.
- Password hashing library: `bcrypt`.
- Database query layer: raw SQL with `pg`.
- Query organization: repository pattern.
- Migration strategy: manual SQL migration files, SQL-first, without a migration runner for MVP.
- Test strategy: start with manual verification for Phase 0 and early bootstrap, then introduce `jest` + `supertest` after the first module slice is built.
- Environment configuration library: `dotenv`.
- UUID generation: native `crypto.randomUUID()`.
- CORS: `cors`.
- API documentation/spec: OpenAPI 3.1.1.
- OpenAPI source: `docs/openapi.yaml`, maintained contract-first from `docs/mvp-api-contract.md`.
- Runtime API docs UI: not included.

Phase 0 finalized these choices so Phase 1 can install the right packages and avoid tool churn. We are choosing `express-validator` because it is simple in Express routes and approachable while learning backend validation. The tradeoff is that validators can become scattered, so every module should keep validation chains in dedicated `*.validators.js` files and expose them through a shared `validateRequest` middleware.

Manual SQL migrations are chosen because this project intentionally uses raw SQL and should teach schema changes directly. The tradeoff is discipline: migration files must be ordered, reviewable, and applied consistently. We can add a migration runner later if manual execution becomes error-prone.

OpenAPI generation from validation schemas remains deferred. For now, `docs/openapi.yaml` is hand-authored and contract-first.

Environment rule:

- `backend/.env` holds local backend secrets and is ignored by Git.
- Root `.env.example` is committed with placeholders only.
- Real Neon database URLs must not be committed in docs, examples, tests, or source code.

---

## 3. Current Planning Documents

The main planning documents are:

- `docs/mvp-api-contract.md`
- `docs/backend-architecture.md`
- `docs/implementation-plan.md`
- `docs/openapi-guidance.md`
- `docs/openapi.yaml`

`docs/mvp-api-contract.md` converts the MVP feature breakdown into exact backend contracts.

For each endpoint, define:

- Method and URL
- Actor allowed
- Request body
- Response body
- Validation rules
- Success status code
- Error cases
- Schema tables touched
- Service method name

Example:

```http
POST /appointments
```

Should define:

- Patient can book only for self
- Doctor must exist and be active
- Appointment time must not conflict
- Backend checks `appointments` and `doctor_unavailability`
- Returns `409 Conflict` when the slot is unavailable

This API contract is the bridge between planning and coding.

---

## 4. MVP Scope Control

Before coding, we should freeze what belongs in MVP.

MVP includes:

- Auth
- Users
- Patient profile
- Doctor profile
- Staff profile
- Doctor search
- Appointment booking
- Consultation visit
- Prescribed medicines inside visit
- Doctor-assigned tests
- Patient-created hospital lab orders
- External report upload
- Internal lab report upload
- Basic billing and payments

MVP excludes:

- Ratings
- Analytics dashboard
- Online payment gateway
- Full audit UI
- Advanced prescription workflow
- Pharmacy inventory
- Lab machine integration
- Insurance claims
- Granular staff permissions

If a feature is not required for the core patient-doctor-lab-billing flow, it should wait.

---

## 5. Backend Architecture Guidance

The Express backend should be structured with clear separation of concerns.

Current architecture decision:

- JavaScript, not TypeScript for MVP.
- ES modules because `backend/package.json` uses `"type": "module"`.
- Raw SQL through `pg`, not an ORM.
- Repository pattern to keep SQL out of controllers and services.
- Shared transaction helper for workflows that update multiple tables.

Recommended layers:

| Layer | Responsibility |
|---|---|
| Routes | Define URL paths and attach middleware/controllers |
| Controllers | Handle HTTP request/response only |
| Services | Contain business logic |
| Repositories | Handle database queries |
| DTOs/Validators | Define and validate request/response shapes |
| Middleware | Authentication, role checks, error handling |
| Policies/Guards | Data ownership and permission checks |
| Utilities | Shared helpers such as password hashing and token signing |

Important rule:

Controllers should stay thin. Business logic belongs in services.

Bad direction:

```text
Controller validates input, checks conflicts, writes database, calculates status, and returns response.
```

Better direction:

```text
Controller receives request
  -> Validator checks input
  -> Service performs business flow
  -> Repository performs database access
  -> Controller returns response
```

This keeps the project easier to test and maintain.

---

## 6. Finalized Node/Express Folder Structure

Initial structure:

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

Rules:

- Routes define paths and attach middleware/controllers.
- Controllers read HTTP input and return HTTP output.
- Services own business workflows and transaction boundaries.
- Repositories own SQL only.
- Policies answer authorization/ownership questions that are more specific than simple role checks.
- `db/pool.js` owns PostgreSQL connection pooling.
- `db/transaction.js` owns reusable `BEGIN` / `COMMIT` / `ROLLBACK` behavior.

---

## 7. Phase 1 Implementation Plan

Phase 1 should build the runnable backend bootstrap only:

- Project metadata under `backend`
- Express app/server separation
- direct `dotenv` loading from `backend/.env`
- Initial folder structure
- `GET /health`

Why this comes first:

Every later phase depends on a predictable app skeleton and startup path.

Phase 1 should not implement database connection, shared error/validation middleware, auth, users, profiles, repositories, or role guards. Those belong to later phases.

## 7.1 Phase 2 Implementation Plan

Phase 2 should build the database foundation:

- `pg` pool
- transaction helper
- first manual schema migration
- database connectivity check
- migration instructions using `MIGRATION_DATABASE_URL`

Phase 2 should not implement domain repositories or seed data.

---

## 8. Testing Strategy

Manual smoke checks should start from Phase 1. Automated tests should start after the first real module slice exists, unless we explicitly revise the Phase 0 testing decision.

For each module, we should include:

- Unit tests for services
- Integration tests for API endpoints
- Validation tests
- Authorization tests
- Ownership tests
- Edge case tests

High-priority test cases:

- Login success and failure
- Inactive user cannot log in
- Patient can access own profile
- Patient cannot access another patient's data
- Doctor can access assigned patient data only
- Appointment conflict prevention
- Visit can be created only once per appointment
- Patient can order assigned tests at hospital
- External report can complete an assigned test
- Payment cannot exceed invoice due amount

Tests are not only for correctness. They also tell us whether the design is clean.

---

## 9. Implementation Session Style

We should implement in small edit sessions.

Good session size:

- One module slice
- One clear behavior
- One testable outcome

Example sessions:

1. Project bootstrap and health route
2. Database connection, transaction helper, and migration setup
3. Shared API foundation and validation middleware
4. Auth register/login
5. JWT middleware and role guard
6. Patient profile APIs
7. Doctor profile APIs
8. Appointment booking conflict checks
9. Visit creation and visit report
10. Assigned tests and lab orders
11. Billing and payment tracking

Before each edit session, we should confirm the scope and expected output.

---

## 10. Production Rules To Keep From Day One

Do not postpone these:

- Backend validation on every write request
- Password hashing
- No plaintext secrets in code
- Environment variables for configuration
- Consistent error response format
- Role-based access control
- Data ownership checks
- Pagination on list APIs
- Transactional safety for critical writes
- Timezone-safe timestamps
- Decimal-safe money handling

These are not "advanced" features. They are baseline correctness.

---

## 11. Engineering Mindset

When designing each feature, ask:

1. Who is allowed to do this?
2. What data can they access?
3. What can go wrong?
4. What should happen if it fails?
5. Which database tables are touched?
6. Does this need a transaction?
7. What should be tested?
8. What should be kept out of MVP?

This thinking keeps the code production-minded instead of endpoint-driven only.

---

## 12. Recommended Next Action

Use the detailed phase plans to implement:

- `docs/phase-plans/phase-01-project-bootstrap.md`
- `docs/phase-plans/phase-02-database-foundation.md`

Phase 1 should stay limited to runnable app bootstrap. Phase 2 should stay limited to database infrastructure and the initial manual migration.
