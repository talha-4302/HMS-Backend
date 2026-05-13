# Phase 3: Shared API Foundation

## Background & Goal

The backend now has:

1. A runnable Express app.
2. A PostgreSQL pool.
3. A reusable transaction helper.
4. An initial schema migration file.

Before implementing auth, users, appointments, visits, lab, reports, or billing, the API needs consistent cross-cutting behavior.

Phase 3 creates the shared API foundation:

1. Standard application errors.
2. Standard error response formatting.
3. Async controller error forwarding.
4. Request validation formatting.
5. Not-found handling.
6. Optional success response helper.
7. Role authorization helper that depends on `req.user`, without implementing JWT verification yet.

This phase should answer:

> Can every future route return errors and validation failures in one consistent API shape?

---

## Current Path Note

The backend root is now:

```text
backend
```

This phase plan uses the current root directly. If older phase plans still contain historical path wording, do not update them during Phase 3 unless the stale wording blocks implementation.

---

## Confirmed Decisions

| Topic | Decision |
|---|---|
| Backend root | `backend` |
| Module system | ES modules, using `import` / `export` |
| API base path | `/api/v1` for domain routes later |
| Health route | Keep `GET /health` app-only |
| Request validation library | `express-validator` |
| Error response shape | Standard envelope with `success: false` |
| Success response shape | Standard envelope with `success: true` |
| Auth implementation | Not in Phase 3 |
| JWT verification | Phase 4 |
| Database access | Not required for Phase 3 |
| OpenAPI UI | Not served by Express |

---

## Out Of Scope

Do **not** implement these in Phase 3:

- Register, login, refresh, logout, or `auth/me`.
- JWT signing or verification.
- Password hashing helpers.
- Refresh token logic.
- Auth repositories, services, controllers, or routes.
- Domain repositories.
- Domain services.
- Domain controllers.
- Database queries.
- Seed data.
- Swagger UI, `/api-docs`, or runtime OpenAPI serving.

Phase 3 creates shared API behavior only.

---

## Proposed Changes

### 1. Error Codes

#### [NEW] `backend/src/shared/errors/errorCodes.js`

Purpose:

Define stable machine-readable error codes used by API responses.

Why this file exists:

- Keeps error codes consistent across modules.
- Prevents typos like `VALIDATION_ERRROR`.
- Gives the frontend predictable values for error handling.

Initial expected codes:

```js
export const errorCodes = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
});
```

Future phases can add domain-specific codes such as:

- `EMAIL_ALREADY_EXISTS`
- `INVALID_CREDENTIALS`
- `USER_NOT_ACTIVE`
- `APPOINTMENT_SLOT_UNAVAILABLE`

Do not add all future domain codes in Phase 3.

---

### 2. Application Error Class

#### [NEW] `backend/src/shared/errors/AppError.js`

Purpose:

Represent expected application failures in a structured way.

Why this file exists:

- Services need a standard way to throw expected failures.
- The global error handler can distinguish expected errors from unexpected bugs.
- API status, code, message, and details stay together.

Expected implementation shape:

```js
export class AppError extends Error {
  constructor({ statusCode, code, message, details }) {
    super(message);

    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }
}
```

Production logic:

- Expected business failures use `AppError`.
- Unexpected bugs should not expose stack traces or internal details to clients.

---

### 3. Async Handler

#### [NEW] `backend/src/shared/utils/asyncHandler.js`

Purpose:

Forward rejected promises from async controllers/middleware into Express error handling.

Why this file exists:

- Controllers should not repeat `try/catch` around every service call.
- Error flow stays consistent.

Expected implementation shape:

```js
export function asyncHandler(handler) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
```

Usage in later phases:

```js
router.post('/auth/login', asyncHandler(authController.login));
```

---

### 4. Request Validation Middleware

#### [NEW] `backend/src/shared/middleware/validateRequest.js`

Purpose:

Convert `express-validator` failures into the standard API error response.

Why this file exists:

- Validators can stay module-specific.
- Error formatting stays shared.
- Controllers receive only validated requests.

Expected behavior:

1. Read validation failures with `validationResult(req)`.
2. If there are no errors, call `next()`.
3. If validation fails, call `next(new AppError(...))`.
4. Use HTTP `422`.
5. Use error code `VALIDATION_ERROR`.
6. Include field-level details.

Expected validation detail shape:

```json
[
  {
    "field": "email",
    "message": "Email is required"
  }
]
```

Route usage in later phases:

```js
router.post(
  '/auth/login',
  loginValidators,
  validateRequest,
  asyncHandler(authController.login),
);
```

---

### 5. Authorization Role Helper

#### [NEW] `backend/src/shared/middleware/authorizeRole.js`

Purpose:

Provide role checking for future protected routes after authentication has attached `req.user`.

Why this file exists:

- Route-level role checks should be reusable.
- Role checks should not be duplicated in controllers.

Important Phase 3 boundary:

This middleware does **not** verify JWTs. It only checks `req.user.role` if an earlier authentication middleware has already attached `req.user`.

Expected behavior:

- If `req.user` is missing, return `UNAUTHORIZED`.
- If `req.user.role` is not allowed, return `FORBIDDEN`.
- Otherwise call `next()`.

Expected usage in Phase 4+:

```js
router.get(
  '/users',
  authenticate,
  authorizeRole('admin'),
  asyncHandler(usersController.listUsers),
);
```

Do not create `authenticate.js` in Phase 3 unless we intentionally make it a throwing placeholder. Real authentication belongs in Phase 4.

---

### 6. Not Found Handler

#### [NEW] `backend/src/shared/middleware/notFoundHandler.js`

Purpose:

Return a consistent `404` response for unmatched routes.

Why this file exists:

- Unknown endpoints should not return default Express HTML.
- API clients should receive the same error envelope everywhere.

Expected behavior:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Route not found"
  }
}
```

Mounting rule:

Register this after all real routes and before the global error handler.

---

### 7. Global Error Handler

#### [NEW] `backend/src/shared/middleware/errorHandler.js`

Purpose:

Convert thrown errors into the standard API error response.

Why this file exists:

- Controllers and services should not format errors manually.
- Expected errors and unexpected errors need different behavior.
- Production responses should not leak stack traces.

Expected behavior:

For `AppError`:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": []
  }
}
```

For unexpected errors:

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Internal server error"
  }
}
```

Development behavior:

- It is acceptable to log unexpected errors to the server console.
- Do not expose internal stack traces in API responses for now.

Mounting rule:

The error handler must be registered last in `app.js`.

---

### 8. Success Response Helper

#### [NEW] `backend/src/shared/utils/sendSuccess.js`

Purpose:

Provide a small helper for the standard success envelope.

Why this file exists:

- Keeps response shape consistent.
- Avoids each controller manually repeating envelope structure.

Expected shape:

```js
export function sendSuccess(res, { statusCode = 200, data, message, pagination } = {}) {
  return res.status(statusCode).json({
    success: true,
    ...(data !== undefined && { data }),
    ...(message && { message }),
    ...(pagination && { pagination }),
  });
}
```

Tradeoff:

This helper is useful if controllers stay consistent. If it starts hiding too much behavior, later phases can keep direct `res.status(...).json(...)` for simple cases.

---

### 9. Express App Wiring

#### [MODIFY] `backend/src/app.js`

Purpose:

Mount shared route-boundary middleware in the correct order.

Expected order after Phase 3:

```text
dotenv
express app creation
cors
express.json
GET /health
future /api/v1 routes placeholder area
notFoundHandler
errorHandler
```

Important:

`GET /health` can keep its simple response. It does not need the success envelope unless we choose to standardize it now.

No domain routes should be mounted in Phase 3.

---

## File Summary

| File | Action | Complexity | Notes |
|---|---|---:|---|
| `backend/src/shared/errors/errorCodes.js` | New | Light | shared machine-readable codes |
| `backend/src/shared/errors/AppError.js` | New | Light | expected application failure type |
| `backend/src/shared/utils/asyncHandler.js` | New | Light | async error forwarding |
| `backend/src/shared/utils/sendSuccess.js` | New | Light | standard success envelope helper |
| `backend/src/shared/middleware/validateRequest.js` | New | Light | express-validator error formatting |
| `backend/src/shared/middleware/authorizeRole.js` | New | Light | role check against `req.user` only |
| `backend/src/shared/middleware/notFoundHandler.js` | New | Light | consistent 404 response |
| `backend/src/shared/middleware/errorHandler.js` | New | Medium | standard error envelope |
| `backend/src/app.js` | Modify | Light | mount 404 and error middleware |

---

## API Contracts Covered

Phase 3 does not implement domain endpoints.

It implements cross-cutting API contracts from `docs/mvp-api-contract.md`:

- Standard success response envelope.
- Standard error response envelope.
- Validation error formatting.
- Unknown route behavior.

Existing route:

| Method | Path | Expected Phase 3 behavior |
|---|---|---|
| GET | `/health` | Still returns success when the app process is running |
| Any | unknown route | Returns standard `404 NOT_FOUND` JSON |

---

## Flow Breakdown

### Successful Future Request Flow

```text
HTTP request
  -> route
  -> validators
  -> validateRequest
  -> asyncHandler(controller)
  -> controller calls service
  -> sendSuccess response
```

### Validation Failure Flow

```text
HTTP request
  -> route validators fail
  -> validateRequest creates AppError
  -> errorHandler formats 422 response
```

### Expected Business Error Flow

```text
service throws AppError
  -> asyncHandler catches rejected promise
  -> errorHandler formats expected error response
```

### Unexpected Error Flow

```text
bug or unexpected throw
  -> errorHandler logs server-side detail
  -> client receives safe 500 response
```

### Unknown Route Flow

```text
request does not match /health or future API routes
  -> notFoundHandler creates NOT_FOUND AppError
  -> errorHandler returns standard 404 response
```

---

## Validation Rules

Phase 3 does not create endpoint-specific validators.

It creates the shared validation rule:

- Module validators return `express-validator` chains.
- Routes attach validators before controllers.
- `validateRequest` converts validation failures into one standard response shape.
- Controllers should not manually inspect validation errors.

Field detail mapping should prefer:

| express-validator field | API detail field |
|---|---|
| `path` | `field` |
| `msg` | `message` |

---

## Authorization Rules

Phase 3 does not implement authentication.

It may implement `authorizeRole`, but that middleware only works after `req.user` exists.

Rule:

```text
authenticate attaches req.user in Phase 4
authorizeRole checks req.user.role in Phase 3/4+
policies check resource ownership in later domain phases
```

Do not use `authorizeRole` alone on real protected routes before authentication exists.

---

## Database Requirements

No database access is required in Phase 3.

Do not import:

- `pool`
- `withTransaction`
- repositories

This phase should not require `NEON_DATABASE_URL` to run `/health`.

---

## Test Plan

No full automated test suite is required yet unless we decide to introduce Jest in this phase.

Manual verification should cover:

1. `GET /health` still returns `200`.
2. Unknown route returns standard `404`.
3. A temporary route or local check can confirm `AppError` formats correctly.
4. A temporary route or local check can confirm unexpected errors return safe `500`.
5. A temporary route or local check can confirm validation details are shaped correctly.

If automated tests are introduced here, keep the scope narrow:

- `AppError` unit test.
- `asyncHandler` unit test.
- `validateRequest` middleware behavior.
- `errorHandler` formatting.

Do not add domain integration tests in Phase 3.

---

## Manual Verification

Run from `backend`:

```powershell
node --check src/app.js
node --check src/shared/errors/AppError.js
node --check src/shared/errors/errorCodes.js
node --check src/shared/utils/asyncHandler.js
node --check src/shared/utils/sendSuccess.js
node --check src/shared/middleware/validateRequest.js
node --check src/shared/middleware/authorizeRole.js
node --check src/shared/middleware/notFoundHandler.js
node --check src/shared/middleware/errorHandler.js
```

Start the backend:

```powershell
npm run dev
```

Expected checks:

```http
GET http://localhost:3000/health
```

Expected:

- HTTP `200`.
- App does not require a database connection.

```http
GET http://localhost:3000/unknown-route
```

Expected:

- HTTP `404`.
- Standard error envelope:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Route not found"
  }
}
```

---

## Security & Production Notes

Security:

- Do not expose stack traces to clients.
- Do not reveal internal SQL, file paths, secrets, or dependency errors in API responses.
- Keep authentication out of Phase 3 to avoid fake security.

Reliability:

- Every future async controller should use `asyncHandler`.
- Every expected service failure should use `AppError`.
- Validation failures should never reach service logic.

Maintainability:

- Error codes are centralized.
- Error formatting is centralized.
- Validation formatting is centralized.
- Controllers remain thin.

---

## Risks And Tradeoffs

Risk:

Adding too many helpers too early can create abstraction noise.

Mitigation:

Keep helpers small and only cover repeated cross-cutting behavior.

Risk:

Creating authentication placeholder middleware can give a false sense of security.

Mitigation:

Do not implement fake `authenticate` behavior. Phase 4 owns real JWT verification.

Risk:

Different modules may invent their own error codes later.

Mitigation:

Add domain error codes deliberately as phases need them.

---

## Study Gaps

Phase 3 learning topics:

- Express middleware order.
- Express error middleware signature.
- Async error forwarding.
- Operational vs programming errors.
- Standard API response envelopes.
- `express-validator` result formatting.
- Why validation belongs before controllers.
- Why role checks are not enough for ownership-sensitive healthcare data.

---

## Acceptance Criteria

Phase 3 is complete when:

- `AppError` exists.
- Shared error codes exist.
- `asyncHandler` exists.
- `validateRequest` exists.
- `authorizeRole` exists and only checks existing `req.user`.
- `notFoundHandler` exists.
- `errorHandler` exists.
- Optional `sendSuccess` helper exists.
- `app.js` mounts `notFoundHandler` and `errorHandler` in the correct order.
- Unknown routes return standard JSON `404`.
- Unexpected errors return safe JSON `500`.
- Validation errors can be formatted into the standard error envelope.
- `/health` still works without database or auth env values.
- No auth endpoints, JWT logic, password hashing, repositories, services, domain routes, or seed data are added.
