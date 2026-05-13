# Phase 4: Auth And Sessions

## Background & Goal

The backend now has:

1. Express app/bootstrap.
2. PostgreSQL pool and transaction helper.
3. Initial database schema applied.
4. Minimal shared API error and validation foundation.

Phase 4 introduces identity:

1. Patient registration.
2. Login.
3. Refresh token session handling.
4. Logout.
5. Current user lookup through `/auth/me`.
6. Real authentication middleware that attaches `req.user`.

This phase should answer:

> Can the API securely identify a user and maintain refresh-token-backed sessions?

---

## Current Path Note

The backend root is:

```text
backend
```

Use this path for all Phase 4 commands and files. Do not back-edit older phase plans unless stale wording blocks implementation.

---

## Confirmed Decisions

| Topic | Decision |
|---|---|
| Backend root | `backend` |
| Module system | ES modules |
| Auth route prefix | `/api/v1/auth` |
| Password hashing | `bcrypt` |
| Access token | JWT using `jsonwebtoken` |
| Refresh token transport | httpOnly cookie only |
| Refresh token storage | Store only refresh token hash |
| Refresh token strategy | Rotate refresh token on every refresh |
| Logout behavior | Idempotent; always clears cookie |
| Runtime DB URL | `NEON_DATABASE_URL` |
| Env helper file | No central `src/config/env.js` |
| Validation | `express-validator` plus shared `validateRequest` |
| Error format | Shared `AppError` plus `errorHandler` |
| Transactions | `withTransaction` for register/session writes |
| CSRF handling | Deferred |
| Seed data | Not in Phase 4 |

Because this project does not use a central env helper, auth utilities should read required env vars directly where needed and fail clearly when missing.

---

## Current Dependency Status

Already satisfied:

- `users`, `patient_profiles`, and `refresh_sessions` tables exist through `001_initial_schema.sql`.
- `backend/src/db/pool.js` exists.
- `backend/src/db/transaction.js` exists.
- `AppError`, `errorCodes`, `validateRequest`, `notFoundHandler`, and `errorHandler` exist.

Required before Phase 4 implementation:

```env
JWT_ACCESS_SECRET=replace-with-long-random-access-secret
JWT_REFRESH_SECRET=replace-with-long-random-refresh-secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_SALT_ROUNDS=12
```

Current check result:

- `NEON_DATABASE_URL` is present in `backend/.env`.
- Auth env vars listed above are present in `backend/.env`.

Do not implement Phase 4 code that silently falls back to weak secrets.

---

## Out Of Scope

Do **not** implement these in Phase 4:

- Admin user creation.
- Doctor/staff account creation.
- User list endpoint.
- User status update endpoint.
- Patient profile update/read endpoints outside `/auth/me`.
- Doctor/staff profile management.
- Role policies for patient/doctor data ownership.
- Seed data.
- Email verification.
- Password reset.
- MFA.
- OAuth/social login.
- Full audit logging.
- Rate limiting.
- CSRF protection.
- Cookie-based sessions.

These belong to later phases or hardening.

---

## API Contracts Covered

| Method | Path | Actor | Purpose |
|---|---|---|---|
| POST | `/api/v1/auth/register` | Public | Register a patient account |
| POST | `/api/v1/auth/login` | Public | Login and create refresh session |
| POST | `/api/v1/auth/refresh` | Public with refresh cookie | Rotate refresh token and create new access token |
| POST | `/api/v1/auth/logout` | Public with optional refresh cookie | Revoke refresh session if present and clear cookie |
| GET | `/api/v1/auth/me` | Authenticated | Return current user and role profile summary |

Base route mount:

```text
backend/src/app.js
  -> app.use('/api/v1/auth', authRoutes)
```

---

## Proposed Files

### Auth Module

```text
backend/src/modules/auth/
  auth.routes.js
  auth.controller.js
  auth.service.js
  auth.repository.js
  auth.validators.js
```

Responsibilities:

| File | Owns | Must Not Own |
|---|---|---|
| `auth.routes.js` | URL paths, middleware order | Business rules or SQL |
| `auth.controller.js` | HTTP request/response mapping | SQL or password/JWT internals |
| `auth.service.js` | auth workflow, business rules, transactions | raw SQL strings |
| `auth.repository.js` | SQL queries for users/profiles/sessions | HTTP behavior |
| `auth.validators.js` | request validation chains | database reads/writes |

### Shared Utilities / Middleware

```text
backend/src/shared/utils/password.js
backend/src/shared/utils/token.js
backend/src/shared/utils/authCookie.js
backend/src/shared/middleware/authenticate.js
```

Responsibilities:

| File | Owns |
|---|---|
| `password.js` | bcrypt hashing/comparison, salt-round env validation |
| `token.js` | access token signing/verification, refresh token generation/hashing |
| `authCookie.js` | refresh token cookie set/clear options |
| `authenticate.js` | Bearer token verification and `req.user` attachment |

### Existing Files To Modify

```text
backend/src/app.js
backend/src/shared/errors/errorCodes.js
.env.example
```

Notes:

- `app.js` mounts auth routes before `notFoundHandler`.
- `app.js` enables CORS credentials because refresh tokens are sent through cookies.
- `app.js` uses cookie parsing middleware so auth routes can read the refresh cookie.
- `errorCodes.js` gets auth/domain-specific error codes needed in this phase only.
- `.env.example` should document auth env names if missing.

---

## Data Model Used

Phase 4 uses:

```text
users
patient_profiles
refresh_sessions
```

Table responsibilities:

| Table | Use In Phase 4 |
|---|---|
| `users` | identity, email, password hash, role, status |
| `patient_profiles` | patient profile created during public registration |
| `refresh_sessions` | refresh token hash, expiry, revocation |

No seed rows should be inserted.

---

## Endpoint Design

### 1. Register Patient

#### `POST /api/v1/auth/register`

Purpose:

Create a public patient account.

Request body:

```json
{
  "email": "patient@example.com",
  "password": "StrongPass123!",
  "firstName": "Rahim",
  "lastName": "Ahmed",
  "phone": "01700000000"
}
```

Service flow:

```text
validate request
  -> normalize email
  -> check duplicate email
  -> hash password
  -> withTransaction
      -> create user with role patient
      -> create patient_profile
      -> create refresh session
  -> set refresh token httpOnly cookie
  -> return user, patient profile, access token
```

Why transaction:

User and patient profile must be created together. A user without the required patient profile would break later patient workflows.

Expected errors:

- `VALIDATION_ERROR`
- `EMAIL_ALREADY_EXISTS`

---

### 2. Login

#### `POST /api/v1/auth/login`

Purpose:

Authenticate a user and create a refresh session.

Request body:

```json
{
  "email": "patient@example.com",
  "password": "StrongPass123!"
}
```

Service flow:

```text
validate request
  -> normalize email
  -> find user by email
  -> compare password
  -> confirm user status is active
  -> create refresh session
  -> return access token, refresh token, user
```

Security rule:

For wrong email or wrong password, return the same `INVALID_CREDENTIALS` error. Do not reveal whether the email exists.

Expected errors:

- `VALIDATION_ERROR`
- `INVALID_CREDENTIALS`
- `USER_NOT_ACTIVE`

---

### 3. Refresh

#### `POST /api/v1/auth/refresh`

Purpose:

Issue a new short-lived access token from a valid refresh token.

Request body:

```json
{}
```

MVP refresh strategy:

- Store only a hash of the refresh token.
- Read the raw refresh token from an httpOnly cookie.
- Verify the hash exists.
- Reject revoked sessions.
- Reject expired sessions.
- Reject if user is no longer active.
- Revoke the old refresh session.
- Create a new refresh session.
- Set a new refresh token httpOnly cookie.
- Return a new access token.

CSRF note:

Cookies are automatically sent by browsers. CSRF protection is explicitly deferred for now, but the implementation should keep cookie settings centralized so hardening can be added later.

Expected errors:

- `VALIDATION_ERROR`
- `INVALID_REFRESH_TOKEN`
- `USER_NOT_ACTIVE`

---

### 4. Logout

#### `POST /api/v1/auth/logout`

Purpose:

Revoke a refresh session.

Request body:

```json
{}
```

Service flow:

```text
validate request
  -> read refresh token cookie if present
  -> hash refresh token if present
  -> mark matching refresh session revoked when found
  -> clear refresh token cookie
  -> return success
```

Security rule:

Logout is idempotent. Return success even if the refresh token cookie is missing, expired, already revoked, or invalid. Always clear the cookie.

---

### 5. Current User

#### `GET /api/v1/auth/me`

Purpose:

Return current authenticated user and role-specific profile summary.

Service flow:

```text
authenticate middleware verifies access token
  -> req.user contains user id, email, role
  -> service loads user and profile summary
  -> return user plus profile
```

Profile behavior:

- Patient: load from `patient_profiles`.
- Doctor/staff/admin: profile support can be minimal in Phase 4 because doctor/staff creation is Phase 5.

Expected errors:

- `UNAUTHORIZED`
- `USER_NOT_ACTIVE`
- `PROFILE_NOT_FOUND`

---

## Validation Rules

### Register

- `email` is required and must be valid.
- `password` is required.
- `password` must meet minimum strength rules.
- `firstName` is required.
- `lastName` is required.
- `phone` is optional for now unless contract is tightened.
- `role` must not be accepted from request body.

Minimum password rule for MVP:

```text
at least 8 characters
contains at least one letter
contains at least one number
```

### Login

- `email` is required and must be valid.
- `password` is required.

### Refresh / Logout

- Refresh reads the refresh token from the httpOnly cookie.
- Refresh fails when the cookie is missing or invalid.
- Logout reads the refresh token from the httpOnly cookie when present.
- Logout still succeeds when the cookie is missing or invalid.

---

## Token Design

### Access Token

Payload:

```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "role": "patient"
}
```

Env:

```env
JWT_ACCESS_SECRET=...
JWT_ACCESS_EXPIRES_IN=15m
```

Rules:

- Access token should be short-lived.
- Do not put sensitive profile data in JWT.
- `authenticate` should verify token and attach minimal `req.user`.

### Refresh Token

Format:

- Generate a cryptographically random token string.
- Store only a hash in `refresh_sessions.refresh_token_hash`.
- Return the raw refresh token only once to the client.

Env:

```env
JWT_REFRESH_SECRET=...
JWT_REFRESH_EXPIRES_IN=7d
```

Implementation note:

Refresh token can be an opaque random token signed/hashed with Node `crypto`, or a JWT-like token. For MVP, prefer opaque random token plus stored hash because the database session is the source of truth.

Cookie rule:

The raw refresh token must never be returned in JSON. It is sent only through `Set-Cookie`.

Recommended cookie options:

```js
{
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/api/v1/auth',
  maxAge: refreshTokenMaxAgeMs,
}
```

Frontend implication:

Refresh/logout requests must include credentials.

---

## Repository Contract

Auth repository methods must accept `db` as the first argument.

Expected methods:

```js
findUserByEmail(db, email)
findUserById(db, userId)
createPatientUser(db, input)
createPatientProfile(db, input)
createRefreshSession(db, input)
findRefreshSessionByHash(db, refreshTokenHash)
markRefreshSessionUsed(db, refreshSessionId)
revokeRefreshSession(db, refreshSessionId)
revokeRefreshSessionByHash(db, refreshTokenHash)
findProfileSummaryByUser(db, user)
```

Rules:

- All SQL uses parameterized queries.
- Services decide transaction boundaries.
- Repository methods do not format HTTP responses.
- Repository methods do not hash passwords or tokens.

---

## Transaction Requirements

Use `withTransaction` for:

- Register:
  - create user
  - create patient profile
  - create refresh session
- Refresh:
  - revoke old refresh session
  - create new refresh session

Consider transaction for:

- Login refresh session creation plus last login update.
- Refresh session last-used update.
- Logout session revocation.

Rule:

Inside `withTransaction`, every repository call must use the passed transaction client.

---

## Security & Production Notes

Security:

- Never store plain passwords.
- Never store raw refresh tokens.
- Never return raw refresh tokens in JSON.
- Do not log tokens or password values.
- Do not reveal whether email or password was wrong.
- Reject inactive, flagged, or soft-deleted users.
- Use long random JWT secrets.
- Keep auth env vars out of Git.
- Refresh cookies must be `httpOnly`.
- CSRF protection is deferred intentionally and should be revisited during hardening.

Operational:

- Missing auth env values must fail clearly when auth utilities are used.
- `/health` should not require auth env values.
- Do not seed users until auth hashing logic exists and is understood.

Scalability:

- `users.email` is unique and indexed by the unique constraint.
- `refresh_sessions.refresh_token_hash` is unique for fast lookup.
- Later cleanup can remove expired/revoked refresh sessions.

---

## Verification Plan

### Static Checks

Run from `backend`:

```powershell
node --check src/app.js
node --check src/modules/auth/auth.routes.js
node --check src/modules/auth/auth.controller.js
node --check src/modules/auth/auth.service.js
node --check src/modules/auth/auth.repository.js
node --check src/modules/auth/auth.validators.js
node --check src/shared/middleware/authenticate.js
node --check src/shared/utils/password.js
node --check src/shared/utils/token.js
```

### Manual API Checks

Expected manual checks:

- Register patient succeeds.
- Register sets refresh token cookie and does not return refresh token in JSON.
- Duplicate email returns `409 EMAIL_ALREADY_EXISTS`.
- Login succeeds with correct password.
- Login sets refresh token cookie and does not return refresh token in JSON.
- Login fails with wrong password.
- Inactive user cannot login.
- Refresh rotates refresh session, sets a new refresh cookie, and returns a new access token.
- Logout is idempotent, revokes refresh session when present, and clears refresh cookie.
- `/auth/me` succeeds with valid access token.
- `/auth/me` fails without token.

### Database Checks

After manual API calls, verify:

- `users.password_hash` is not plain text.
- `refresh_sessions.refresh_token_hash` is not the raw refresh token.
- patient registration creates exactly one linked patient profile.

No real patient data should be used.

---

## Implementation Sessions

Recommended smaller edit sessions:

### Session 4.1: Auth Utilities And Middleware

Files:

- `backend/src/shared/utils/password.js`
- `backend/src/shared/utils/token.js`
- `backend/src/shared/utils/authCookie.js`
- `backend/src/shared/middleware/authenticate.js`
- `backend/src/shared/errors/errorCodes.js`

Outcome:

- Password and token helpers exist.
- Refresh cookie helper exists.
- Auth middleware can verify access tokens and attach `req.user`.

### Session 4.2: Auth Repository And Validators

Files:

- `backend/src/modules/auth/auth.repository.js`
- `backend/src/modules/auth/auth.validators.js`

Outcome:

- SQL access methods exist.
- Request validation chains exist.

### Session 4.3: Auth Service

Files:

- `backend/src/modules/auth/auth.service.js`

Outcome:

- Register, login, refresh, logout, and current-user workflows exist.

### Session 4.4: Routes, Controller, App Wiring

Files:

- `backend/src/modules/auth/auth.controller.js`
- `backend/src/modules/auth/auth.routes.js`
- `backend/src/app.js`

Outcome:

- Auth endpoints are mounted under `/api/v1/auth`.

### Session 4.5: Manual Verification And Fixes

Outcome:

- Manual API checks pass.
- Auth flow is ready for Phase 5.

---

## Study Gaps

Phase 4 learning topics:

- Password hashing vs encryption.
- Bcrypt salt rounds.
- JWT access token claims.
- Access token vs refresh token.
- Refresh token hashing.
- Refresh token rotation.
- httpOnly cookie behavior.
- Why cookie-based refresh introduces CSRF concerns.
- Session revocation.
- Why not store raw tokens.
- Why duplicate login errors should not reveal account existence.
- Auth middleware flow.
- How `req.user` becomes the base for later RBAC and policies.

---

## Acceptance Criteria

Phase 4 is complete when:

- Required auth env vars are present.
- Public patient registration works.
- Login works.
- Refresh token is sent only as an httpOnly cookie.
- Register/login do not return refresh tokens in JSON.
- Refresh rotates refresh sessions.
- Logout is idempotent and clears the refresh cookie.
- `authenticate` middleware verifies Bearer access tokens.
- `GET /api/v1/auth/me` returns current user context.
- Passwords are stored only as hashes.
- Refresh tokens are stored only as hashes.
- Inactive/flagged/soft-deleted users cannot authenticate.
- All auth SQL is parameterized.
- Registration uses a transaction.
- Errors use the shared standard error envelope.
- Validation failures use `validateRequest`.
- No seed data, admin creation, doctor/staff creation, or profile management endpoints are added.
