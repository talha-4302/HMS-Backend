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

- Validation library: decision deferred; compare options before request validation implementation.
- Authentication/JWT library: `jsonwebtoken`.
- Password hashing library: `bcrypt`.
- Database query layer/ORM: Prisma ORM.
- Migration tool: decision deferred; revisit Prisma Migrate when schema changes begin.
- Test framework: `jest` + `supertest`.
- Environment configuration library: `dotenv`.
- UUID generation: native `crypto.randomUUID()`.
- CORS: `cors`.
- API documentation/spec: OpenAPI 3.1.1.
- Interactive API docs: Swagger UI served with `swagger-ui-express` at `/api-docs`.
- OpenAPI source: `docs/openapi.yaml`, maintained contract-first from `docs/mvp-api-contract.md`.

Validation and migration tooling are intentionally still open because they affect developer experience and long-term maintainability. OpenAPI generation from validation schemas is also deferred until we choose the validation library. Before coding those parts, we should compare options, tradeoffs, and how much complexity is appropriate for the MVP.

---

## 3. Immediate Next Step

The next document should be:

`docs/mvp-api-contract.md`

This document should convert the MVP feature breakdown into exact backend contracts.

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

## 6. Suggested Node/Express Folder Structure

Possible structure:

```text
src/
  app.js
  server.js

  config/
    env.js
    db.js

  modules/
    auth/
      auth.routes.js
      auth.controller.js
      auth.service.js
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
    labs/
    reports/
    billing/

  middlewares/
    authenticate.js
    authorizeRole.js
    errorHandler.js
    validateRequest.js

  policies/
    patientAccessPolicy.js
    doctorAccessPolicy.js

  shared/
    errors/
    utils/
    constants/
```

We should finalize structure after deciding the database access strategy.

---

## 7. Phase 1 Implementation Plan

Phase 1 should build the foundation:

- Project setup
- Environment configuration
- Database connection
- Shared error response model
- Request validation pattern
- Auth module
- User module
- Patient profile
- Doctor profile
- Staff profile
- Role guard

Why this comes first:

Every other module depends on authenticated identity, role access, and profile records.

---

## 8. Testing Strategy

Testing should start from Phase 1.

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

1. Project structure and shared middleware
2. Database connection and migration setup
3. Auth register/login
4. JWT middleware and role guard
5. Patient profile APIs
6. Doctor profile APIs
7. Appointment booking conflict checks
8. Visit creation and visit report
9. Assigned tests and lab orders
10. Billing and payment tracking

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

Create:

`docs/mvp-api-contract.md`

Start with Phase 1 APIs:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /patients/me`
- `PATCH /patients/me`
- `GET /doctors`
- `GET /doctors/{doctorId}`
- `PATCH /doctors/me`
- `POST /users`
- `PATCH /users/{userId}/status`

Once Phase 1 API contracts are clear, we can design the Node/Express architecture and start implementation safely.
