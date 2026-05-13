# HMS MVP Implementation Plan

## 1. Purpose

This document is the master implementation plan for the Healthcare Management System MVP.

It connects:

- `docs/mvp-feature-breakdown.md`
- `db/schema.md`
- `docs/mvp-api-contract.md`
- `docs/backend-architecture.md`
- `docs/openapi.yaml`

The goal is to build in dependency order, keep each implementation session reviewable, and learn the production reasoning behind each module.

This is not the detailed plan for every phase. Each phase should get its own detailed phase plan before implementation starts.

## 2. Working Workflow

Every major phase follows this loop:

```text
Brainstorm
  -> Planning
  -> Detailed phased planning
  -> Implement
  -> Review
  -> Change/study gaps
```

Meaning:

- Brainstorm: clarify the problem, risks, and options.
- Planning: choose the approach and tradeoffs.
- Detailed phased planning: define exact files, functions, SQL, tests, and acceptance criteria.
- Implement: make the smallest useful production-quality slice.
- Review: check correctness, security, tests, maintainability, and API contract alignment.
- Change/study gaps: document what changed and what needs more learning.

## 3. Architecture Baseline

Implementation uses:

- JavaScript
- ES modules
- Node.js
- Express.js
- PostgreSQL
- Raw SQL with `pg`
- Repository pattern
- `express-validator` for request validation
- Manual SQL migration files
- `db/pool.js` for connection pooling
- `db/transaction.js` for transaction safety
- OpenAPI 3.1.1 contract file, without runtime API docs UI

Backend implementation lives under `backend`.

Request flow:

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

Important rule:

Controllers stay thin. Business rules live in services. SQL lives in repositories.

## 4. Dependency Graph

The high-level dependency order is:

```text
Project foundation
  -> Database foundation
  -> Shared API foundation
  -> Auth/users
  -> Profiles
  -> Doctor discovery
  -> Scheduling and appointments
  -> Visits
  -> Assigned tests
  -> Lab orders and internal reports
  -> External reports
  -> Billing and payments
  -> Admin/operational access
  -> OpenAPI completion and hardening
```

The domain dependency order is:

```text
users
  -> patient_profiles / doctor_profiles / staff_profiles
  -> doctor_unavailability
  -> appointments
  -> visits
  -> visit_assigned_tests
  -> lab_orders / lab_order_items / lab_reports
  -> patient_reports / report_attachments
  -> invoices / invoice_items / payments
```

## 5. Phase Overview

| Phase | Name | Main Output | Depends On |
|---:|---|---|---|
| 0 | Final Decisions and Repo Hygiene | Remaining tool decisions recorded | Existing docs |
| 1 | Project Bootstrap | Runnable Express app skeleton | Phase 0 |
| 2 | Database Foundation | `pg` pool, transaction helper, schema setup path | Phase 1 |
| 3 | Shared API Foundation | errors, responses, async handling, validation pattern | Phase 1 |
| 4 | Auth and Sessions | register, login, refresh, logout, auth/me | Phases 2-3 |
| 5 | Users and Profiles | admin user creation/status, patient/doctor/staff profiles | Phase 4 |
| 6 | Doctor Discovery and Availability | doctor list/detail, available slots, unavailability | Phase 5 |
| 7 | Appointment Flow | booking, detail, lists, cancellation | Phase 6 |
| 8 | Visit Lifecycle | start visit, update notes, complete visit, visit report base | Phase 7 |
| 9 | Assigned Tests and Catalog | test catalog, assign tests, cancel assigned test | Phase 8 |
| 10 | Lab Orders and Internal Reports | lab orders, order items, status updates, internal reports | Phase 9 |
| 11 | External Patient Reports | external report upload, attachments, patient report lists | Phase 9 |
| 12 | Billing and Payments | auto invoice after visit completion, invoice items, payments | Phases 8-11 |
| 13 | Admin and Operational Lists | normal resources with admin authorization | Phases 5-12 |
| 14 | OpenAPI Completion and Hardening | full OpenAPI, test expansion, security review, refactor | All MVP phases |

## 6. Phase Plans

## Phase 0: Final Decisions and Repo Hygiene

Purpose:

Resolve decisions that affect implementation style before code begins.

Deliverables:

- Confirm validation library choice: `express-validator`.
- Confirm migration strategy: manual SQL files.
- Confirm `.env` naming convention and `.env.example`.
- Confirm test database strategy: defer automated setup until the first module slice, then use `jest`, `supertest`, and `TEST_DATABASE_URL`.
- Confirm local development ports.
- Confirm docs and database planning files are tracked by Git.

Key decisions:

- Validation uses `express-validator`.
- Migration files are manual SQL; no migration runner dependency in Phase 1.
- Real Neon connection strings stay in local `backend/.env` only.
- `MIGRATION_DATABASE_URL` uses a direct Neon connection for schema setup and migrations.
- `backend/.env` is local-only and `.env.example` contains placeholders only.
- Raw SQL with `pg` is finalized.
- JavaScript/ES modules is finalized.

Testing focus:

- No automated Phase 0 tests are required because only docs and repo metadata changed.
- Manual verification checks `.gitignore`, `.env.example`, and planning doc consistency.
- Automated tests begin after a runnable module exists.

Study gaps:

- `express-validator` route chains and shared validation error handling.
- Manual SQL migration workflow and rollback thinking.
- Test database setup with Neon/local PostgreSQL.

Exit criteria:

- We know exactly which dependencies Phase 1 should install.
- We know how schema changes will be applied during early development.
- No live secrets are stored in committed docs or examples.

## Phase 1: Project Bootstrap

Purpose:

Create the runnable backend application skeleton.

Modules involved:

- app bootstrap
- server bootstrap
- shared folder structure

Deliverables:

- `backend/package.json` normalized for ES modules
- `backend/src/app.js`
- `backend/src/server.js`
- initial `backend/src/` folder structure from `docs/backend-architecture.md`
- health check endpoint: `GET /health`
- basic development scripts: `dev` and `start`

Dependency notes:

- This phase should not implement domain logic.
- This phase should not create database connection code.
- This phase should not create a custom env helper.
- This phase should load `backend/.env` directly with `dotenv`.
- This phase should make later modules easy to plug in.

Testing focus:

- Manual smoke check: app starts with `npm run dev`.
- Manual smoke check: health endpoint returns success.

Study gaps:

- Express app vs server separation.
- Environment loading with `dotenv`.
- ES module import/export patterns.

Exit criteria:

- Backend can start locally.
- Manual request confirms `/health` responds.

## Phase 2: Database Foundation

Purpose:

Create safe PostgreSQL access patterns before any module writes SQL.

Modules involved:

- `db/pool.js`
- `db/transaction.js`
- schema setup
- manual migration setup

Deliverables:

- PostgreSQL pool configured with `pg`.
- `query` or pool export for simple queries.
- `withTransaction` helper.
- `db/migrations/001_initial_schema.sql` created from `db/schema.md`.
- Manual migration instructions using `MIGRATION_DATABASE_URL`.
- Env validation expanded for `NEON_DATABASE_URL` and `MIGRATION_DATABASE_URL`.
- First database connectivity check.

Dependency notes:

- Repositories in later phases must accept a `db` argument.
- Services that update multiple tables must use `withTransaction`.
- `NEON_DATABASE_URL` may use the pooled Neon app URL.
- `MIGRATION_DATABASE_URL` must use the direct Neon URL for schema setup.
- `TEST_DATABASE_URL` remains documented but not required until integration tests begin.
- This phase should not add domain repositories or seed data.

Testing focus:

- Manual check: database connection succeeds with valid `NEON_DATABASE_URL`.
- Manual check: database connection fails clearly with invalid `NEON_DATABASE_URL`.
- Manual check: initial migration can be applied to an empty Neon database using `MIGRATION_DATABASE_URL`.
- Manual check: transaction helper commits, rolls back, and releases the client.

Study gaps:

- PostgreSQL connection pool vs client.
- Why transaction queries must use the same client.
- Parameterized queries and SQL injection prevention.

Exit criteria:

- We can safely run one simple SQL query from the app/test environment.
- Transaction behavior is understood and tested.

## Phase 3: Shared API Foundation

Purpose:

Build reusable API patterns before implementing business modules.

Modules involved:

- shared errors
- shared middleware
- request validation pattern
- auth middleware shell
- OpenAPI contract maintenance

Deliverables:

- `AppError`
- error code constants
- global error handler
- `asyncHandler`
- standard success response helper, if useful
- `validateRequest` middleware shape
- initial `authenticate` and `authorizeRole` middleware structure
- OpenAPI contract remains maintained as `docs/openapi.yaml`

Dependency notes:

- `express-validator` is finalized; implement real validators with module-level validation chains plus shared `validateRequest`.
- Auth middleware may be skeletal until Phase 4 token logic exists.

Testing focus:

- Unknown route returns consistent 404.
- Thrown `AppError` returns standard error shape.
- Unexpected error returns safe generic response.
- OpenAPI contract file remains reviewable.

Study gaps:

- Express error middleware order.
- Async error handling in Express.
- Standard response design.
- OpenAPI spec source maintenance.

Exit criteria:

- All later modules can use common error, validation, and response patterns.

## Phase 4: Auth and Sessions

Purpose:

Implement identity and session foundations.

Schema tables:

- `users`
- `patient_profiles`
- `refresh_sessions`

API contracts:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

Deliverables:

- auth routes/controller/service/repository/validators
- patient self-registration
- password hashing with `bcrypt`
- access token creation with `jsonwebtoken`
- refresh session creation
- refresh token rotation or refresh handling decision
- logout session revocation
- authenticated user middleware completed

Dependency notes:

- Patient registration creates both `users` and `patient_profiles`.
- Doctor/staff/admin creation does not belong in public register.

Testing focus:

- Register success.
- Duplicate email fails.
- Login success.
- Wrong password fails.
- Inactive user cannot login.
- Refresh with valid token succeeds.
- Refresh with revoked/expired token fails.
- Logout revokes refresh session.
- `auth/me` returns role-aware identity.

Study gaps:

- JWT claims.
- Access token vs refresh token.
- Refresh token hashing.
- Password hashing salt rounds.
- Auth threat modeling.

Exit criteria:

- The system can identify authenticated users and their roles.

## Phase 5: Users and Profiles

Purpose:

Implement role-specific account/profile management.

Schema tables:

- `users`
- `patient_profiles`
- `doctor_profiles`
- `staff_profiles`

API contracts:

- `GET /api/v1/users`
- `POST /api/v1/users`
- `PATCH /api/v1/users/{userId}/status`
- `GET /api/v1/patients/me`
- `PATCH /api/v1/patients/me`
- `GET /api/v1/patients/{patientId}`
- `PATCH /api/v1/doctors/me`

Deliverables:

- user admin workflows
- patient profile read/update
- doctor profile self-update
- staff profile creation through admin user creation
- role guard integration
- patient access policy foundation
- doctor access policy foundation

Dependency notes:

- Admin creates doctor/staff users.
- Patient self profile depends on authenticated user.
- Doctor access to patient profile requires relationship checks later; initial policy can be prepared and completed as appointment/visit data exists.

Testing focus:

- Admin can create doctor/staff.
- Public/user cannot create privileged roles.
- Admin can update user status.
- Patient can read/update own profile.
- Patient cannot read another patient profile.
- Doctor patient access respects relationship once data exists.

Study gaps:

- RBAC vs ownership.
- Soft delete vs inactive status.
- Profile table separation.
- Avoiding over-permissioned doctor access.

Exit criteria:

- Users and profiles are usable by scheduling and clinical phases.

## Phase 6: Doctor Discovery and Availability

Purpose:

Allow authenticated users to discover active doctors and available appointment times.

Schema tables:

- `doctor_profiles`
- `users`
- `appointments`
- `doctor_unavailability`

API contracts:

- `GET /api/v1/doctors`
- `GET /api/v1/doctors/{doctorId}`
- `GET /api/v1/doctors/{doctorId}/available-slots`
- `POST /api/v1/doctors/me/unavailability`

Deliverables:

- authenticated doctor list/detail
- active doctor filtering
- specialty filtering
- available slot computation
- doctor unavailability creation
- pagination for doctor list

Dependency notes:

- Doctor discovery requires doctor profiles from Phase 5.
- Available slots depend on appointments, but appointment booking is Phase 7.

Testing focus:

- Unauthenticated users cannot browse doctors.
- Inactive doctors are not bookable.
- Specialty filter works.
- Available slots exclude existing scheduled appointments.
- Available slots exclude doctor unavailability.
- Doctor can create own unavailability.

Study gaps:

- Timezone-safe slot calculations.
- Query-time computation vs stored slots.
- Date/time validation.

Exit criteria:

- Appointment booking has reliable doctor availability inputs.

## Phase 7: Appointment Flow

Purpose:

Implement booking and appointment lifecycle basics.

Schema tables:

- `appointments`
- `patient_profiles`
- `doctor_profiles`
- `doctor_unavailability`

API contracts:

- `POST /api/v1/appointments`
- `GET /api/v1/appointments/{appointmentId}`
- `GET /api/v1/patients/me/appointments`
- `GET /api/v1/doctors/me/appointments`
- `POST /api/v1/appointments/{appointmentId}/cancel`

Deliverables:

- patient self-booking
- staff/admin booking for patients
- conflict-safe booking
- appointment detail access
- patient appointment list
- doctor appointment queue
- cancellation with reason

Dependency notes:

- Booking uses patients, doctors, unavailability, and existing appointments.
- Booking conflict check plus insert must be transactional.

Testing focus:

- Patient can book for self.
- Staff can book for a patient.
- Patient cannot book for another patient.
- Appointment conflict returns `409`.
- Doctor unavailability blocks booking.
- Patient sees own appointments.
- Doctor sees own appointments.
- Unauthorized users cannot view unrelated appointment details.

Study gaps:

- Race conditions in booking.
- SQL conflict queries.
- Transaction isolation basics.
- Access policies for shared resources.

Exit criteria:

- The system supports safe scheduling, which unlocks visits.

## Phase 8: Visit Lifecycle

Purpose:

Implement clinical visit creation, editing, completion, and report view.

Schema tables:

- `visits`
- `appointments`
- `patient_profiles`
- `doctor_profiles`

API contracts:

- `POST /api/v1/appointments/{appointmentId}/visit/start`
- `PATCH /api/v1/visits/{visitId}`
- `POST /api/v1/visits/{visitId}/complete`
- `GET /api/v1/visits/{visitId}/report`

Deliverables:

- start visit from scheduled appointment
- one visit per appointment
- doctor-only visit updates
- symptoms/diagnoses JSONB handling
- prescribed medicines JSONB handling
- completed visits immutable
- visit report base response
- appointment marked completed on visit completion

Dependency notes:

- Visit start requires appointment flow.
- Visit completion later triggers invoice creation in Phase 12; until then it may return visit only or use a temporary internal placeholder based on detailed phase planning.

Testing focus:

- Assigned doctor can start visit.
- Non-assigned doctor cannot start visit.
- Visit cannot be started twice for one appointment.
- Doctor can update in-progress visit.
- Completed visit cannot be edited.
- Visit completion sets end time and status.
- Visit report respects patient/doctor/staff/admin access.

Study gaps:

- JSONB validation strategy.
- Clinical immutability.
- Lifecycle actions vs generic patching.

Exit criteria:

- Doctors can complete the core consultation flow without lab/billing extensions.

## Phase 9: Assigned Tests and Catalog

Purpose:

Implement doctor-assigned tests and the test catalog.

Schema tables:

- `test_catalog`
- `visit_assigned_tests`
- `visits`

API contracts:

- `GET /api/v1/test-catalog`
- `POST /api/v1/test-catalog`
- `POST /api/v1/visits/{visitId}/assigned-tests`
- `PATCH /api/v1/visit-assigned-tests/{assignedTestId}/cancel`

Deliverables:

- list test catalog
- admin create test catalog item
- doctor assigns tests during visit
- prevent duplicate test assignment per visit
- doctor-only cancellation of assigned tests
- assigned test status rules

Dependency notes:

- Assigned tests require visits.
- Lab and report phases depend on assigned tests.

Testing focus:

- Patients can view catalog where allowed.
- Admin can create catalog item.
- Non-admin cannot create catalog item.
- Assigned doctor can assign tests.
- Duplicate test assignment fails.
- Doctor can cancel only `assigned` tests.
- Ordered/completed tests cannot be cancelled through MVP endpoint.

Study gaps:

- Master data management.
- Status transition enforcement.
- Unique constraints and application-level conflict handling.

Exit criteria:

- The system can capture medical test recommendations before lab/report fulfillment.

## Phase 10: Lab Orders and Internal Reports

Purpose:

Implement hospital-side lab ordering and internal report upload.

Schema tables:

- `lab_orders`
- `lab_order_items`
- `lab_reports`
- `visit_assigned_tests`
- `patient_profiles`
- `test_catalog`
- `patient_reports`

API contracts:

- `POST /api/v1/lab-orders`
- `PATCH /api/v1/lab-order-items/{itemId}/status`
- `POST /api/v1/lab-order-items/{itemId}/report`

Deliverables:

- patient/staff/admin creates lab order from assigned tests
- lab order item creation
- assigned test status changes to `ordered_internal`
- lab item status transition handling
- internal report upload
- linked assigned test completion
- patient report metadata creation for internal report if contract requires it

Dependency notes:

- Lab orders depend on assigned tests.
- Report upload plus assigned test completion must be transactional.

Testing focus:

- Patient can order own assigned tests.
- Staff/admin can order for patient.
- Cannot order cancelled assigned test.
- Cannot order already internally ordered assigned test.
- Status transitions are valid.
- Internal report completes lab item and linked assigned test.
- Partial failure rolls back related updates.

Study gaps:

- Transactional multi-table writes.
- Status state machines.
- Internal vs external report source modeling.

Exit criteria:

- Hospital lab workflow can fulfill assigned tests.

## Phase 11: External Patient Reports

Purpose:

Allow patients to upload outside reports and view report history.

Schema tables:

- `patient_reports`
- `report_attachments`
- `visit_assigned_tests`

API contracts:

- `POST /api/v1/patients/me/reports`
- `GET /api/v1/patients/me/reports`
- `GET /api/v1/patients/{patientId}/reports`
- `POST /api/v1/patient-reports/{reportId}/attachments`

Deliverables:

- external report upload
- attachment metadata creation
- linked assigned test auto-completion
- patient report list
- doctor/staff/admin patient report access with ownership/relationship checks
- additional report attachment endpoint

Dependency notes:

- External report upload depends on assigned tests if linked.
- File storage is not in MVP; store `storageKey` or `url` only.

Testing focus:

- Patient can upload own external report.
- Report source is forced to `external`.
- Linked assigned test must belong to patient.
- Linked assigned test becomes `completed`.
- Patient can list own reports.
- Patient cannot list another patient reports.
- Doctor access follows clinical relationship.

Study gaps:

- Metadata vs file upload.
- Storage key safety.
- Report ownership policies.

Exit criteria:

- Patients can fulfill assigned tests externally and keep report history.

## Phase 12: Billing and Payments

Purpose:

Implement billing state after clinical workflows.

Schema tables:

- `invoices`
- `invoice_items`
- `payments`
- `visits`
- `patient_profiles`

API contracts:

- auto-create invoice after `POST /api/v1/visits/{visitId}/complete`
- `POST /api/v1/invoices/{invoiceId}/items`
- `POST /api/v1/invoices/{invoiceId}/payments`
- `GET /api/v1/patients/me/invoices`
- `GET /api/v1/patients/me/payments`

Deliverables:

- auto invoice creation after visit completion
- invoice item creation
- invoice total/due calculation
- payment capture
- invoice status update: `pending`, `partial`, `paid`
- patient invoice list
- patient payment list

Dependency notes:

- Auto invoice creation touches Phase 8 visit completion. Detailed planning must decide whether to refactor Phase 8 completion or keep invoice creation behind a service extension point.
- Payment capture and invoice update must be transactional.
- Money values must not be trusted from frontend totals.

Testing focus:

- Visit completion creates invoice.
- Invoice is not duplicated for same visit.
- Invoice totals are backend-calculated.
- Payment cannot exceed due amount.
- Payment updates paid/due/status atomically.
- Void invoice cannot receive payment.
- Patient can view own invoices/payments only.

Study gaps:

- Decimal-safe money handling.
- Transactional financial writes.
- Idempotency around invoice creation.
- Billing status transitions.

Exit criteria:

- MVP can track consultation/service billing and payments safely.

## Phase 13: Admin and Operational Lists

Purpose:

Finish admin and staff operational visibility using normal resources with admin authorization.

Schema tables:

- `users`
- `patient_profiles`
- `doctor_profiles`
- `appointments`
- `invoices`
- future use of `audit_logs`

API direction:

- Use normal resources with admin authorization.
- Do not create duplicated `/admin/*` controllers for MVP.

Deliverables:

- admin-friendly filters on existing list endpoints
- staff/admin patient lookup where allowed
- admin appointment list if not already covered
- admin invoice list if not already covered
- consistent pagination across operational lists

Dependency notes:

- Admin lists depend on the resources they expose.
- Audit log table exists, but full audit UI is out of MVP.

Testing focus:

- Admin can list operational resources.
- Non-admin cannot use admin-only filters/actions.
- Pagination is consistent.
- Soft-deleted/inactive users are handled according to contract.

Study gaps:

- Admin authorization without route duplication.
- Pagination consistency.
- Operational read models.

Exit criteria:

- Staff/admin workflows are usable without violating the normal resource architecture.

## Phase 14: OpenAPI Completion and Hardening

Purpose:

Complete the contract and harden the MVP before calling it production-grade.

Deliverables:

- `docs/openapi.yaml` covers all MVP endpoints.
- OpenAPI contract is reviewable locally.
- Endpoint examples are safe and realistic.
- Integration tests cover core workflows.
- Security review completed.
- Performance/index review completed.
- Refactor pass completed.
- Study gaps documented.

Testing focus:

- Full auth workflow.
- Full appointment workflow.
- Full visit workflow.
- Assigned test internal lab flow.
- Assigned test external report flow.
- Full billing/payment flow.
- Authorization and ownership failures.
- Transaction rollback behavior.

Study gaps:

- OpenAPI completeness checks.
- Security checklist.
- Performance review basics.
- Refactoring without changing behavior.

Exit criteria:

- MVP backend is coherent, tested, documented, and ready for review/demo.

## 7. Module Dependency Matrix

| Module | Requires | Unlocks |
|---|---|---|
| Auth | users, refresh_sessions | all protected workflows |
| Users/profiles | auth | doctor discovery, appointments, policies |
| Doctor discovery | doctor_profiles, users | appointment booking |
| Availability | doctor_profiles, appointments, doctor_unavailability | appointment booking |
| Appointments | patients, doctors, availability | visits |
| Visits | appointments, patients, doctors | assigned tests, visit reports, billing trigger |
| Assigned tests | visits, test_catalog | lab orders, external report completion |
| Lab orders | assigned tests, patients, test_catalog | internal lab reports |
| Patient reports | patients, assigned tests | report history, clinical visibility |
| Billing | visits, patients | payments, invoice history |
| Admin lists | all domain resources | operational management |

## 8. Detailed Phase Plan Template

Each detailed phase plan should be created before coding that phase.

Recommended path:

```text
docs/phase-plans/phase-XX-name.md
```

Template:

```text
# Phase X: Name

## Goal

## Dependencies

## Scope

## Out of Scope

## Files to Create or Modify

## API Contracts Covered

## Database Tables Used

## Service Design

## Repository Design

## Validation Rules

## Authorization and Ownership Rules

## Transaction Requirements

## Test Plan

## Manual Verification

## Risks and Tradeoffs

## Study Gaps

## Exit Criteria
```

## 9. Review Checklist Per Phase

Before a phase is considered complete:

- API behavior matches `docs/mvp-api-contract.md`.
- OpenAPI is updated for endpoints touched in the phase.
- Controllers are thin.
- Business rules live in services.
- SQL lives in repositories.
- All SQL uses parameters.
- Multi-table writes use `withTransaction`.
- Auth and ownership rules are tested.
- Validation failures return standard error shape.
- Success responses follow the standard success shape.
- List endpoints use pagination.
- No real patient data appears in examples/tests.
- Study gaps are recorded.

## 10. Cross-Phase Study Gap Tracker

These learning topics should be revisited during the relevant phases:

| Topic | Primary Phase |
|---|---:|
| Express app/server separation | 1 |
| Environment config | 1 |
| `pg` pool vs client | 2 |
| Transactions | 2, 7, 8, 10, 12 |
| Validation library | 0, 3 |
| Error handling | 3 |
| JWT auth | 4 |
| Refresh token security | 4 |
| RBAC vs ownership | 5, 7, 11, 13 |
| SQL conflict checks | 7 |
| JSONB validation | 8 |
| State transitions | 8, 9, 10, 12 |
| Decimal money handling | 12 |
| Integration testing | 4 onward |
| OpenAPI maintenance | all endpoint phases |
| Security review | 14 |

## 11. Deferred Decisions

These are intentionally not resolved inside the master plan:

- Refresh token rotation depth.
- Whether OpenAPI schemas are hand-written forever or later generated from validators.
- Whether audit logging is implemented during MVP or only prepared for later.
- Test database reset strategy after automated integration tests are introduced.

Each deferred decision should be resolved in the detailed phase plan where it first blocks implementation.

## 12. Recommended Next Step

Create the detailed plans for Phase 1 and Phase 2:

```text
docs/phase-plans/phase-01-project-bootstrap.md
docs/phase-plans/phase-02-database-foundation.md
```

These plans should prepare implementation without writing backend feature code.
