# HMS MVP API Contract

## 1. Purpose

This document defines the MVP API contract for the Healthcare Management System backend.

The goal is to make implementation predictable before coding begins:

- Which endpoints exist
- Who can call them
- What request body is expected
- What response body is returned
- What validation rules apply
- Which schema tables are touched
- What errors should be returned
- Why a design was chosen
- What alternatives were considered

This is intentionally written as a reviewable draft. You can comment on any endpoint, request shape, naming choice, or workflow decision before we implement.

---

## 2. API Design Principles

## 2.1 Base URL

Recommended base path:

```http
/api/v1
```

Example:

```http
POST /api/v1/auth/login
```

### Why this design?

Versioning from the beginning keeps future breaking changes cleaner. If the API changes later, we can introduce `/api/v2` without silently breaking existing clients.

### Alternative considered

Use no version prefix:

```http
/api/auth/login
```

This is simpler at first, but becomes harder when clients depend on old behavior.

---

## 2.2 Authentication

Protected endpoints use Bearer token authentication.

```http
Authorization: Bearer <accessToken>
```

### Why this design?

Bearer JWT access tokens work well for a stateless Node/Express API. Middleware can verify the token and attach the authenticated user to the request.

### Alternative considered

Use server-side cookie sessions.

Cookie sessions are valid and often better for browser-only apps, but JWT access tokens are simpler for APIs that may later support web, mobile, or external clients.

---

## 2.3 Current User Routes

For self-owned data, use `/me`.

Examples:

```http
GET /api/v1/patients/me
PATCH /api/v1/patients/me
GET /api/v1/patients/me/appointments
```

### Why this design?

`me` means "the profile belonging to the authenticated user." The frontend does not need to know the patient's internal profile ID for common self-service actions.

Backend flow:

```text
JWT -> authenticated user id -> profile table lookup by user_id
```

### Alternative considered

Use only ID-based routes:

```http
PATCH /api/v1/patients/{patientId}
```

This is still needed for admin/staff/doctor access, but using it for patient self-service creates a security risk if ownership checks are missed.

---

## 2.4 Standard Success Response

Recommended response shape:

```json
{
  "success": true,
  "data": {},
  "message": "Optional human-readable message"
}
```

For list endpoints:

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Why this design?

A consistent envelope makes frontend error handling and loading states easier. Pagination metadata is predictable across list endpoints.

### Alternative considered

Return raw data directly.

```json
[]
```

That is simpler, but less consistent when adding metadata, messages, or pagination later.

---

## 2.5 Standard Error Response

Recommended error shape:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Email is required"
      }
    ]
  }
}
```

Common status codes:

| Status | Meaning |
|---:|---|
| `400` | Bad request shape |
| `401` | Missing or invalid authentication |
| `403` | Authenticated but not allowed |
| `404` | Resource not found or not visible |
| `409` | Conflict, duplicate, or invalid state transition |
| `422` | Domain validation failed |
| `500` | Unexpected server error |

### Why this design?

Production APIs need predictable error handling. The frontend should know whether to show field errors, permission messages, conflict messages, or generic failure states.

### Alternative considered

Return different error shapes from each endpoint.

That is faster initially, but it makes frontend and testing work messy.

---

## 2.6 Pagination Standard

List endpoints should support:

```http
?page=1&limit=20
```

Default:

```text
page = 1
limit = 20
max limit = 100
```

### Why this design?

Pagination prevents large queries and large responses as the system grows.

### Alternative considered

Return all rows.

This may work during seed data testing, but it becomes risky quickly for patients, appointments, reports, invoices, and audit-like data.

---

## 3. Auth and Roles

## 3.1 `POST /api/v1/auth/register`

Registers a patient account.

### Actor

- Public

### Schema Tables

- `users`
- `patient_profiles`

### Request Body

```json
{
  "email": "patient@example.com",
  "password": "StrongPass123!",
  "firstName": "Rahim",
  "lastName": "Ahmed",
  "phone": "01700000000"
}
```

### Response `201 Created`

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "patient@example.com",
      "role": "patient",
      "status": "active"
    },
    "patientProfile": {
      "id": "uuid",
      "firstName": "Rahim",
      "lastName": "Ahmed"
    }
  },
  "message": "Registration successful"
  // Here we need to get jwt access token and refresh token ,how do we do that
}
```


### Validation Rules

- `email` is required and must be valid.
- `email` must be unique.
- `password` is required.
- `password` must meet minimum strength rules.
- `firstName` and `lastName` are required.
- Patient role is assigned by the system, not accepted from the request body.

### Errors

| Status | Code | Meaning |
|---:|---|---|
| `409` | `EMAIL_ALREADY_EXISTS` | Email is already registered |
| `422` | `VALIDATION_ERROR` | Request body failed validation |

### Why this design?

Public registration should create only patient accounts. Doctor and staff accounts need admin control because they affect hospital operations and access to patient data.

### Alternative considered

Allow users to choose any role during registration.

Rejected for MVP because someone could self-register as doctor/admin/staff without verification.

---

## 3.2 `POST /api/v1/auth/login`

Logs in a user and creates a session.

### Actor

- Public

### Schema Tables

- `users`
- `refresh_sessions`

### Request Body

```json
{
  "email": "patient@example.com",
  "password": "StrongPass123!"
}
```

### Response `200 OK`

```json
{
  "success": true,
  "data": {
    "accessToken": "jwt-access-token",
    "refreshToken": "refresh-token",
    "user": {
      "id": "uuid",
      "email": "patient@example.com",
      "role": "patient",
      "status": "active"
    }
  }
}
```

### Validation Rules

- `email` is required.
- `password` is required.
- User must exist.
- Password must match.
- User status must be `active`.

### Errors

| Status | Code | Meaning |
|---:|---|---|
| `401` | `INVALID_CREDENTIALS` | Email or password is wrong |
| `403` | `USER_NOT_ACTIVE` | User is inactive, flagged, or soft deleted |

### Why this design?

The response includes both tokens and basic user information so the frontend can immediately route the user by role.

### Alternative considered

Return only tokens and force frontend to call `/auth/me`.

That is cleaner in some systems, but it adds an extra request after every login. We can still keep `/auth/me` for refresh/page reload scenarios.

---

## 3.3 `POST /api/v1/auth/refresh`

Creates a new access token using a refresh token.

### Actor

- Authenticated by valid refresh token

### Schema Tables

- `refresh_sessions`
- `users`

### Request Body

```json
{
  "refreshToken": "refresh-token"
}
```

### Response `200 OK`

```json
{
  "success": true,
  "data": {
    "accessToken": "new-jwt-access-token"
  }
}
```

### Validation Rules

- Refresh token is required.
- Refresh token must exist by hash.
- Refresh session must not be revoked.
- Refresh session must not be expired.
- User must still be active.

### Errors

| Status | Code | Meaning |
|---:|---|---|
| `401` | `INVALID_REFRESH_TOKEN` | Token is invalid, revoked, or expired |
| `403` | `USER_NOT_ACTIVE` | User can no longer authenticate |

### Why this design?

Short-lived access tokens reduce risk if stolen. Refresh sessions allow controlled session revocation.

### Alternative considered

Use long-lived access tokens only.

Rejected because stolen tokens would remain useful for too long.

---

## 3.4 `POST /api/v1/auth/logout`

Logs out the current refresh session.

### Actor

- Authenticated user

### Schema Tables

- `refresh_sessions`

### Request Body

```json
{
  "refreshToken": "refresh-token"
}
```

### Response `200 OK`

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### Validation Rules

- Refresh token is required.
- Matching refresh session is marked revoked.

### Why this design?

Access tokens may remain valid briefly, but revoking the refresh session prevents long-term reuse.

### Alternative considered

Do not store refresh sessions.

That makes logout weaker because the backend cannot revoke refresh tokens reliably.

---

## 3.5 `GET /api/v1/auth/me`

Returns the current authenticated user and role profile summary.

### Actor

- Authenticated user

### Schema Tables

- `users`
- `patient_profiles`
- `doctor_profiles`
- `staff_profiles`

### Response `200 OK`

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "patient@example.com",
      "role": "patient",
      "status": "active"
    },
    "profile": {
      "id": "uuid",
      "type": "patient",
      "firstName": "Rahim",
      "lastName": "Ahmed"
    }
  }
}
```

### Why this design?

Frontend often needs current user and profile context after refresh/page reload.

### Alternative considered

Create separate `/patients/me`, `/doctors/me`, and `/staff/me` calls only.

Those still exist, but `/auth/me` gives a role-aware bootstrap endpoint.

---

## 4. Users and Profiles

## 4.1 `GET /api/v1/users`

Admin lists users.

### Actor

- Admin

### Schema Tables

- `users`

### Query Params

```http
?role=doctor&status=active&page=1&limit=20
```

### Response `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "email": "doctor@example.com",
      "role": "doctor",
      "status": "active",
      "createdAt": "2026-05-11T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

### Why this design?

Admin user management needs a simple list with role and status filters.

### Alternative considered

Separate list endpoints for each user role only.

Role-specific endpoints are still useful for profiles, but admin account management is easier from a unified `users` resource.

---

## 4.2 `POST /api/v1/users`

Admin creates doctor or staff users.

### Actor

- Admin

### Schema Tables

- `users`
- `doctor_profiles`
- `staff_profiles`

### Request Body

```json
{
  "email": "doctor@example.com",
  "password": "StrongPass123!",
  "role": "doctor",
  "doctorProfile": {
    "specialty": "Cardiology",
    "credentials": {
      "degree": "MBBS, FCPS"
    }
  }
}
```

For staff:

```json
{
  "email": "staff@example.com",
  "password": "StrongPass123!",
  "role": "staff",
  "staffProfile": {
    "department": "Lab",
    "title": "Lab Technician"
  }
}
```

### Response `201 Created`

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "doctor@example.com",
      "role": "doctor",
      "status": "active"
    },
    "profile": {
      "id": "uuid",
      "type": "doctor"
    }
  }
}
```

### Validation Rules

- `email` is required and unique.
- `password` is required.
- `role` must be `doctor` or `staff` for MVP admin creation.
- `doctorProfile` is required when role is `doctor`.
- `staffProfile` is required when role is `staff`.

### Why this design?

Admin-controlled creation protects privileged roles.

### Alternative considered

Create separate endpoints:

```http
POST /api/v1/doctors
POST /api/v1/staff
```

That is also valid, but one admin user-creation endpoint keeps account creation centralized.

---

## 4.3 `PATCH /api/v1/users/{userId}/status`

Admin updates user account status.

### Actor

- Admin

### Schema Tables

- `users`

### Request Body

```json
{
  "status": "inactive"
}
```

Allowed statuses:

- `active`
- `inactive`
- `flagged`
- `soft_deleted`

### Response `200 OK`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "doctor@example.com",
    "role": "doctor",
    "status": "inactive"
  }
}
```

### Why this design?

Status updates are explicit and safer than deleting accounts.

### Alternative considered

Use `DELETE /users/{userId}` for deactivation.

Rejected for MVP because healthcare data should preserve history.

---

## 4.4 `GET /api/v1/patients/me`

Patient views own profile.

### Actor

- Patient

### Schema Tables

- `patient_profiles`
- `users`

### Response `200 OK`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "firstName": "Rahim",
    "lastName": "Ahmed",
    "dob": "1998-01-15",
    "gender": "male",
    "phone": "01700000000",
    "address": "Dhaka",
    "bloodGroup": "B+",
    "allergies": "Penicillin"
  }
}
```

### Why this design?

The patient does not need to know their internal `patient_profiles.id`.

### Alternative considered

Force the frontend to store `patientId`.

This increases frontend state requirements and can lead to accidental ownership bugs.

---

## 4.5 `PATCH /api/v1/patients/me`

Patient updates own profile.

### Actor

- Patient

### Schema Tables

- `patient_profiles`

### Request Body

```json
{
  "firstName": "Rahim",
  "lastName": "Ahmed",
  "dob": "1998-01-15",
  "gender": "male",
  "phone": "01700000000",
  "address": "Dhaka",
  "bloodGroup": "B+",
  "allergies": "Penicillin"
}
```

### Response `200 OK`

Returns the updated patient profile.

### Validation Rules

- `firstName` and `lastName` cannot be empty if provided.
- `gender` must match `gender_type`.
- `bloodGroup` must match `blood_group_type`.
- `dob` must be a valid date and should not be in the future.

### Why this design?

The authenticated user decides ownership, not request body fields.

### Alternative considered

Allow `userId` or `patientId` in the body.

Rejected because identity-sensitive ownership should come from the token.

---

## 4.6 `GET /api/v1/patients/{patientId}`

Doctor, staff, or admin views a patient profile.

### Actor

- Doctor, if patient is assigned/related through appointment or visit
- Staff
- Admin

### Schema Tables

- `patient_profiles`
- `appointments`
- `visits`

### Response `200 OK`

Returns patient profile summary.

### Why this design?

Doctors need patient details during care, but access should be tied to clinical relationship.

### Alternative considered

Allow every doctor to view every patient.

Rejected because healthcare data requires data-level access control.

---

## 4.7 `GET /api/v1/doctors`

Lists/searches doctors.

### Actor

- Authenticated user

### Schema Tables

- `doctor_profiles`
- `users`

### Query Params

```http
?specialty=Cardiology&page=1&limit=20
```

### Response `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "specialty": "Cardiology",
      "isActive": true,
      "credentials": {
        "degree": "MBBS, FCPS"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

### Why this design?

Doctor discovery is needed before appointment booking. Requiring authentication keeps the MVP authorization model simple and avoids supporting a separate public data surface too early.

### Alternative considered

Create a separate `doctor-search` resource.

Valid later if search becomes complex, but `GET /doctors` is enough for MVP.

---

## 4.8 `GET /api/v1/doctors/{doctorId}`

Returns doctor profile details.

### Actor

- Authenticated user

### Schema Tables

- `doctor_profiles`
- `users`

### Response `200 OK`

Returns doctor profile details safe for authenticated users.

### Why this design?

Patients need doctor detail before booking. For MVP, the details endpoint stays authenticated for the same reason as doctor search: fewer public-access paths and simpler authorization rules.

### Alternative considered

Only show doctors in list view.

Rejected because appointment booking usually needs a profile/details page.

---

## 4.9 `PATCH /api/v1/doctors/me`

Doctor updates own profile.

### Actor

- Doctor

### Schema Tables

- `doctor_profiles`

### Request Body

```json
{
  "specialty": "Cardiology",
  "credentials": {
    "degree": "MBBS, FCPS",
    "yearsOfExperience": 8
  }
}
```

### Response `200 OK`

Returns updated doctor profile.

### Why this design?

Doctors can maintain basic profile data without admin intervention.

### Alternative considered

Require admin approval for every profile update.

Better for mature systems, but unnecessary complexity for MVP.

---

## 5. Doctor Discovery and Appointments

## 5.1 `GET /api/v1/doctors/{doctorId}/available-slots`

Returns available appointment slots for a doctor on a date.

### Actor

- Patient
- Staff
- Admin

### Schema Tables

- `doctor_profiles`
- `appointments`
- `doctor_unavailability`

### Query Params

```http
?date=2026-05-11
```

### Response `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "startAt": "2026-05-11T10:00:00+06:00",
      "endAt": "2026-05-11T10:30:00+06:00"
    }
  ]
}
```

### Validation Rules

- Doctor must exist.
- Doctor must be active.
- Date must be valid.

### Why this design?

Available slots are computed, not stored. This avoids duplicating appointment availability state in MVP.

### Alternative considered

Store every possible slot in a table.

That can help at scale, but creates synchronization problems when doctor availability changes.

---

## 5.2 `POST /api/v1/appointments`

Books an appointment.

### Actor

- Patient
- Staff
- Admin

### Schema Tables

- `appointments`
- `patient_profiles`
- `doctor_profiles`
- `doctor_unavailability`

### Request Body

For patient self-booking:

```json
{
  "doctorId": "uuid",
  "startAt": "2026-05-11T10:00:00+06:00",
  "endAt": "2026-05-11T10:30:00+06:00"
}
```

For staff/admin booking:

```json
{
  "patientId": "uuid",
  "doctorId": "uuid",
  "startAt": "2026-05-11T10:00:00+06:00",
  "endAt": "2026-05-11T10:30:00+06:00"
}
```

### Response `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "patientId": "uuid",
    "doctorId": "uuid",
    "startAt": "2026-05-11T10:00:00+06:00",
    "endAt": "2026-05-11T10:30:00+06:00",
    "status": "scheduled"
  }
}
```

### Validation Rules

- `doctorId` is required.
- `startAt` and `endAt` are required.
- `startAt` must be before `endAt`.
- Doctor must exist and be active.
- Patient must exist.
- Patient self-booking uses authenticated patient profile.
- Requested time must not overlap an existing scheduled appointment.
- Requested time must not overlap doctor unavailability.

### Errors

| Status | Code | Meaning |
|---:|---|---|
| `409` | `APPOINTMENT_SLOT_UNAVAILABLE` | Doctor is already booked or unavailable |
| `403` | `FORBIDDEN_PATIENT_BOOKING` | Patient tried to book for someone else |

### Why this design?

The backend is the source of truth for booking conflicts. Even if the frontend showed a slot as free, the backend must re-check before saving.

### Alternative considered

Trust the frontend slot list.

Rejected because two users can try to book the same slot at nearly the same time.

---

## 5.3 `GET /api/v1/appointments/{appointmentId}`

Returns appointment details.

### Actor

- Patient who owns appointment
- Assigned doctor
- Staff
- Admin

### Schema Tables

- `appointments`
- `patient_profiles`
- `doctor_profiles`

### Response `200 OK`

Returns appointment details with patient and doctor summary.

### Why this design?

Appointment details are shared by several roles, but visibility is role and ownership dependent.

### Alternative considered

Create separate patient/doctor appointment detail endpoints.

That duplicates logic. A single endpoint with access policy is cleaner.

---

## 5.4 `GET /api/v1/patients/me/appointments`

Patient views own appointments.

### Actor

- Patient

### Schema Tables

- `appointments`
- `doctor_profiles`

### Query Params

```http
?status=scheduled&page=1&limit=20
```

### Response `200 OK`

Paginated appointment list.

### Why this design?

Self-owned route avoids passing patient ID from frontend.

### Alternative considered

Use `GET /appointments?patientId=...`.

That is useful for staff/admin, but weaker for patient self-service.

---

## 5.5 `GET /api/v1/doctors/me/appointments`

Doctor views own appointment queue.

### Actor

- Doctor

### Schema Tables

- `appointments`
- `patient_profiles`

### Query Params

```http
?date=2026-05-11&status=scheduled&page=1&limit=20
```

### Response `200 OK`

Paginated appointment list.

### Why this design?

Doctors need a focused queue without manually passing their doctor profile ID.

### Alternative considered

Use `GET /appointments?doctorId=...`.

Better for admin/staff, but `/doctors/me/appointments` is safer for doctors.

---

## 5.6 `POST /api/v1/appointments/{appointmentId}/cancel`

Cancels a scheduled appointment.

### Actor

- Patient who owns appointment
- Staff
- Admin

### Schema Tables

- `appointments`

### Request Body

```json
{
  "reason": "Patient is unavailable"
}
```

### Response `200 OK`

Returns updated appointment with status `cancelled`.

### Validation Rules

- Appointment must exist.
- Appointment must be visible to actor.
- Appointment status must be `scheduled`.
- Cancellation reason is recommended.

### Why this design?

Cancellation is a state transition, so using an action endpoint makes the intent clear.

### Alternative considered

Use generic `PATCH /appointments/{id}` with `{ "status": "cancelled" }`.

Rejected for MVP because lifecycle transitions need business rules, not arbitrary field updates.

---

## 5.7 `POST /api/v1/doctors/me/unavailability`

Doctor blocks unavailable time.

### Actor

- Doctor

### Schema Tables

- `doctor_unavailability`
- `doctor_profiles`

### Request Body

```json
{
  "startAt": "2026-05-11T14:00:00+06:00",
  "endAt": "2026-05-11T16:00:00+06:00",
  "reason": "Personal work"
}
```

### Response `201 Created`

Returns created unavailable block.

### Validation Rules

- `startAt` must be before `endAt`.
- Doctor profile is resolved from authenticated user.

### Why this design?

Doctors should manage their own blocked time without passing doctor IDs.

### Alternative considered

Admin-only unavailability management.

Too restrictive for MVP because doctors need control over availability.

---

## 6. Consultation and Visit Report

## 6.1 `POST /api/v1/appointments/{appointmentId}/visit/start`

Starts a consultation visit from an appointment.

### Actor

- Assigned doctor
- Admin, for support

### Schema Tables

- `visits`
- `appointments`
- `patient_profiles`
- `doctor_profiles`

### Response `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "appointmentId": "uuid",
    "patientId": "uuid",
    "doctorId": "uuid",
    "status": "in_progress",
    "startAt": "2026-05-11T10:05:00+06:00"
  }
}
```

### Validation Rules

- Appointment must exist.
- Appointment must be assigned to the authenticated doctor.
- Appointment status must be `scheduled`.
- Appointment must not already have a visit.

### Errors

| Status | Code | Meaning |
|---:|---|---|
| `409` | `VISIT_ALREADY_EXISTS` | Appointment already has a visit |
| `403` | `NOT_ASSIGNED_DOCTOR` | Doctor is not assigned to this appointment |

### Why this design?

Starting from appointment preserves the real-world flow: appointment first, visit second.

### Alternative considered

Create visits directly with `POST /visits`.

Useful for walk-ins later, but appointment-based visits are simpler for MVP.

---

## 6.2 `PATCH /api/v1/visits/{visitId}`

Updates clinical visit details.

### Actor

- Assigned doctor

### Schema Tables

- `visits`

### Request Body

```json
{
  "symptoms": [
    {
      "name": "Fever",
      "duration": "3 days"
    }
  ],
  "diagnoses": [
    {
      "name": "Viral fever",
      "notes": "Monitor temperature"
    }
  ],
  "visitNotes": "Patient advised rest and fluids.",
  "prescribedMedicines": [
    {
      "medicineName": "Paracetamol",
      "dose": "500mg",
      "frequency": "3 times daily",
      "duration": "3 days",
      "instructions": "After meal"
    }
  ]
}
```

### Response `200 OK`

Returns updated visit.

### Validation Rules

- Visit must exist.
- Visit must be assigned to authenticated doctor.
- Visit status must not be `completed`.
- `prescribedMedicines` must be an array if provided.
- Each medicine requires `medicineName`.

### Why this design?

Prescribed medicines live inside the visit for MVP. This keeps the consultation report simple and avoids separate prescription APIs too early.

### Alternative considered

Use separate `prescriptions` and `prescription_items` tables and endpoints.

That is better for pharmacy, refills, prescription auditing, and medicine analytics. We are postponing it because MVP only needs medicines displayed inside the visit report.

---

## 6.3 `POST /api/v1/visits/{visitId}/assigned-tests`

Doctor assigns tests during a visit.

### Actor

- Assigned doctor

### Schema Tables

- `visit_assigned_tests`
- `visits`
- `test_catalog`

### Request Body

```json
{
  "tests": [
    {
      "testCatalogId": "uuid",
      "instructions": "Fasting not required"
    }
  ]
}
```

### Response `201 Created`

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "visitId": "uuid",
      "testCatalogId": "uuid",
      "status": "assigned",
      "instructions": "Fasting not required"
    }
  ]
}
```

### Validation Rules

- Visit must exist.
- Visit must belong to authenticated doctor.
- Test catalog items must exist.
- Same test cannot be assigned twice for the same visit.
- Assigning a test does not create a lab order.

### Why this design?

Doctor assignment and hospital lab ordering are different business events. A doctor says "you should do these tests"; the patient later decides whether to do them at the hospital or externally.

### Alternative considered

Create `lab_orders` immediately when the doctor assigns tests.

Rejected because the patient may do the test externally or not do it immediately.

---

## 6.4 `PATCH /api/v1/visit-assigned-tests/{assignedTestId}/cancel`

Doctor cancels an assigned test.

### Actor

- Assigned doctor

### Schema Tables

- `visit_assigned_tests`
- `visits`

### Request Body

```json
{
  "reason": "Patient no longer needs this test"
}
```

### Response `200 OK`

Returns updated assigned test with status `cancelled`.

### Validation Rules

- Assigned test must exist.
- Assigned test must belong to a visit owned by the authenticated doctor.
- Assigned test status must be `assigned`.
- Tests already ordered internally or completed cannot be cancelled through this MVP endpoint.
- `reason` is optional for MVP.

### Why this design?

Doctor-only cancellation keeps the medical decision with the clinician who assigned the test. The MVP uses a simple single-step cancellation instead of a request/approval workflow.

### Alternative considered

Allow patient or staff cancellation.

Rejected for MVP because cancelling a medically assigned test changes the clinical plan and should not be a purely operational action.

---

## 6.5 `POST /api/v1/visits/{visitId}/complete`

Completes a visit.

### Actor

- Assigned doctor

### Schema Tables

- `visits`
- `appointments`
- `invoices`
- `invoice_items`

### Response `200 OK`

Returns updated visit with status `completed` and the auto-created invoice summary.

### Validation Rules

- Visit must exist.
- Visit must be assigned to authenticated doctor.
- Visit must not already be completed.
- `end_at` is set by the system.
- Related appointment can be marked `completed`.
- Invoice is created automatically in the same transaction.
- MVP invoice items include the consultation fee and any other billable visit-completion items the service can determine.

### Why this design?

Visit completion is a lifecycle action, not a normal field update.

### Alternative considered

Use `PATCH /visits/{id}` with status field.

Rejected because lifecycle status changes should be guarded by business rules.

---

## 6.6 `GET /api/v1/visits/{visitId}/report`

Returns the frontend-ready visit report.

### Actor

- Patient who owns visit
- Assigned doctor
- Staff/admin where allowed

### Schema Tables

- `visits`
- `visit_assigned_tests`
- `test_catalog`
- `lab_order_items`
- `lab_reports`
- `patient_reports`
- `report_attachments`

### Response `200 OK`

```json
{
  "success": true,
  "data": {
    "visit": {
      "id": "uuid",
      "status": "completed",
      "startAt": "2026-05-11T10:05:00+06:00",
      "endAt": "2026-05-11T10:25:00+06:00"
    },
    "symptoms": [],
    "diagnoses": [],
    "visitNotes": "Patient advised rest and fluids.",
    "prescribedMedicines": [],
    "assignedTests": [
      {
        "assignedTestId": "uuid",
        "testCatalogId": "uuid",
        "name": "CBC",
        "status": "assigned",
        "internalLabOrder": null,
        "externalReport": null
      }
    ]
  }
}
```

### Why this design?

The frontend wants one report-style object. The database should stay normalized where needed, but the UI should not have to manually stitch many endpoints together.

### Alternative considered

Frontend calls visits, assigned tests, lab reports, and patient reports separately.

That works, but creates extra frontend complexity and inconsistent report rendering.

---

## 7. Lab Tests

## 7.1 `GET /api/v1/test-catalog`

Lists available tests.

### Actor

- Doctor
- Patient
- Staff
- Admin

### Schema Tables

- `test_catalog`

### Response `200 OK`

Paginated test list.

### Why this design?

Doctors need this list to assign tests. Patients may also need names/prices before ordering at hospital.

### Alternative considered

Expose test catalog only to doctors/staff.

Possible, but patients benefit from seeing assigned test details and expected prices.

---

## 7.2 `POST /api/v1/test-catalog`

Admin creates a test catalog item.

### Actor

- Admin

### Schema Tables

- `test_catalog`

### Request Body

```json
{
  "name": "CBC",
  "description": "Complete blood count",
  "testCategory": "Blood",
  "defaultPrice": 500
}
```

### Response `201 Created`

Returns created test.

### Validation Rules

- `name` is required and unique.
- `testCategory` is required.
- `defaultPrice` must be greater than or equal to zero.

### Why this design?

Tests are master data. Admin controls them so doctors assign from a clean catalog.

### Alternative considered

Allow doctors to type any test name freely.

Faster initially, but creates duplicates and bad billing/reporting data.

---

## 7.3 `POST /api/v1/lab-orders`

Patient orders assigned tests at the hospital.

### Actor

- Patient
- Staff/admin on behalf of patient

### Schema Tables

- `lab_orders`
- `lab_order_items`
- `visit_assigned_tests`
- `patient_profiles`

### Request Body

Patient self-order:

```json
{
  "assignedTestIds": ["uuid", "uuid"]
}
```

Staff/admin order:

```json
{
  "patientId": "uuid",
  "assignedTestIds": ["uuid", "uuid"]
}
```

### Response `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "patientId": "uuid",
    "status": "requested",
    "items": [
      {
        "id": "uuid",
        "assignedTestId": "uuid",
        "testCatalogId": "uuid",
        "status": "requested"
      }
    ]
  }
}
```

### Validation Rules

- At least one assigned test ID is required.
- Assigned tests must belong to the patient.
- Assigned tests must not already be ordered internally.
- Assigned tests must not be cancelled.
- Creating the lab order updates assigned test status to `ordered_internal`.

### Why this design?

This matches the corrected business flow: patient clicks each assigned test and orders it at the hospital when desired.

### Alternative considered

Doctor creates the lab order during consultation.

Rejected because doctor assignment is medical advice; patient ordering is an operational choice.

---

## 7.4 `PATCH /api/v1/lab-order-items/{itemId}/status`

Staff updates an internal lab test status.

### Actor

- Staff
- Admin

### Schema Tables

- `lab_order_items`
- `lab_orders`
- `visit_assigned_tests`

### Request Body

```json
{
  "status": "processing"
}
```

Allowed status flow:

```text
requested -> sample_collected -> processing -> completed
requested -> cancelled
sample_collected -> cancelled
processing -> cancelled
```

### Response `200 OK`

Returns updated lab order item.

### Why this design?

Status is updated per lab item because different tests in the same order may progress at different speeds.

### Alternative considered

Only track status at `lab_orders` level.

Too coarse if one test is completed and another is still processing.

---

## 7.5 `POST /api/v1/lab-order-items/{itemId}/report`

Staff uploads an internal lab report.

### Actor

- Staff
- Admin

### Schema Tables

- `lab_reports`
- `lab_order_items`
- `lab_orders`
- `visit_assigned_tests`
- `patient_reports`

### Request Body

For JSON metadata plus uploaded file handled by multipart:

```json
{
  "reportTitle": "CBC Report",
  "reportData": {
    "hemoglobin": "13.5"
  },
  "storageKey": "reports/internal/cbc.pdf"
}
```

### Response `201 Created`

Returns created lab report.

### Validation Rules

- Lab order item must exist.
- Lab order item must belong to a valid lab order.
- `reportTitle` is required.
- Either `storageKey` or report data should exist.
- Lab order item status can become `completed`.
- Linked assigned test can become `completed`.

### Why this design?

Internal reports belong to lab workflow, not patient upload workflow.

### Alternative considered

Store all reports only in `patient_reports`.

That is simpler, but loses lab-specific structure and status connection.

---

## 8. Patient Reports and Documents

## 8.1 `POST /api/v1/patients/me/reports`

Patient uploads an external report.

### Actor

- Patient

### Schema Tables

- `patient_reports`
- `report_attachments`
- `visit_assigned_tests`

### Request Body

For metadata:

```json
{
  "title": "External CBC Report",
  "reportDate": "2026-05-11",
  "linkedVisitId": "uuid",
  "linkedAssignedTestId": "uuid",
  "attachment": {
    "fileName": "cbc-report.pdf",
    "mimeType": "application/pdf",
    "storageKey": "reports/external/cbc-report.pdf"
  }
}
```

### Response `201 Created`

Returns created patient report.

### Validation Rules

- Report title is required.
- Report source is set to `external` by the system.
- Linked assigned test must belong to the patient if provided.
- Attachment must have `storageKey` or `url`.
- If linked to an assigned test, the assigned test becomes `completed` in the same transaction.

### Why this design?

External report upload lets the patient complete assigned tests without creating a hospital lab order.

### Alternative considered

Force every assigned test to become a hospital lab order.

Rejected because patients may do tests externally.

---

## 8.2 `GET /api/v1/patients/me/reports`

Patient views own reports.

### Actor

- Patient

### Schema Tables

- `patient_reports`
- `report_attachments`

### Response `200 OK`

Paginated report list.

### Why this design?

Patients need one place to see external and internal documents.

### Alternative considered

Separate internal and external report endpoints.

Not needed for MVP. Source can be a filter later.

---

## 8.3 `GET /api/v1/patients/{patientId}/reports`

Doctor/staff/admin views patient reports.

### Actor

- Assigned doctor
- Staff
- Admin

### Schema Tables

- `patient_reports`
- `report_attachments`
- `appointments`
- `visits`

### Response `200 OK`

Paginated report list.

### Why this design?

Doctors need reports during patient care, but access should still be checked.

### Alternative considered

Allow report lookup by report ID only.

That is useful for details, but patient-level list is needed for history.

---

## 8.4 `POST /api/v1/patient-reports/{reportId}/attachments`

Adds an attachment to an existing patient report.

### Actor

- Patient who owns external report
- Staff/admin for internal or operational use

### Schema Tables

- `patient_reports`
- `report_attachments`

### Request Body

```json
{
  "fileName": "report.pdf",
  "mimeType": "application/pdf",
  "storageKey": "reports/external/report.pdf"
}
```

### Response `201 Created`

Returns created attachment.

### Why this design?

Separating report metadata and attachments allows multiple files per report.

### Alternative considered

Store file fields directly on `patient_reports`.

Simpler, but less flexible when one report has multiple pages/files.

---

## 9. Billing and Payments

## 9.1 Auto-create invoice after visit completion

The MVP does not expose manual invoice creation as a primary client action. When the assigned doctor completes a visit through `POST /api/v1/visits/{visitId}/complete`, the backend creates the invoice automatically.

### Trigger

```http
POST /api/v1/visits/{visitId}/complete
```

### Actor

- Assigned doctor

### Schema Tables

- `invoices`
- `invoice_items`
- `patient_profiles`
- `visits`

### Created Data

```json
{
  "invoice": {
    "id": "uuid",
    "patientId": "uuid",
    "visitId": "uuid",
    "status": "pending",
    "totalAmount": 800,
    "paidAmount": 0,
    "dueAmount": 800,
    "items": [
      {
        "itemType": "consultation",
        "referenceId": "uuid",
        "description": "Consultation fee",
        "quantity": 1,
        "unitPrice": 800,
        "amount": 800
      }
    ]
  }
}
```

### Validation Rules

- Visit must exist and belong to the authenticated doctor.
- Visit must not already be completed.
- Invoice must not already exist for the visit.
- Backend calculates totals; clients never send `totalAmount`, `paidAmount`, or `dueAmount`.
- Invoice creation and visit completion happen in the same transaction.

### Why this design?

Auto-creating the invoice after visit completion removes a manual staff step and keeps billing aligned with the clinical lifecycle. Backend-calculated totals avoid trusting client-side money calculations.

### Alternative considered

Manual staff-created invoices with `POST /api/v1/invoices`.

Rejected for MVP because it adds an operational step after every visit and can leave completed visits without invoices.

---

## 9.2 `POST /api/v1/invoices/{invoiceId}/items`

Adds an item to an invoice.

### Actor

- Staff
- Admin

### Schema Tables

- `invoice_items`
- `invoices`

### Request Body

```json
{
  "itemType": "test",
  "referenceId": "uuid",
  "description": "CBC Test",
  "quantity": 1,
  "unitPrice": 500
}
```

### Response `201 Created`

Returns created invoice item and updated invoice totals.

### Why this design?

Invoice items are line-level billable records. Keeping them separate supports clear billing history.

### Alternative considered

Store invoice items as JSONB inside `invoices`.

Possible for MVP, but separate items are better for billing and future reports.

---

## 9.3 `POST /api/v1/invoices/{invoiceId}/payments`

Records a payment.

### Actor

- Staff
- Admin

### Schema Tables

- `payments`
- `invoices`

### Request Body

```json
{
  "amount": 500,
  "method": "cash"
}
```

### Response `201 Created`

```json
{
  "success": true,
  "data": {
    "payment": {
      "id": "uuid",
      "invoiceId": "uuid",
      "amount": 500,
      "method": "cash"
    },
    "invoice": {
      "id": "uuid",
      "status": "partial",
      "totalAmount": 800,
      "paidAmount": 500,
      "dueAmount": 300
    }
  }
}
```

### Validation Rules

- Invoice must exist.
- Invoice must not be `void`.
- Payment amount must be greater than zero.
- Payment amount cannot exceed due amount.
- Invoice `paidAmount`, `dueAmount`, and `status` update in the same transaction.

### Why this design?

Payment capture must be transactional. We should never create a payment without updating invoice state.

### Alternative considered

Calculate invoice paid/due only from payments at read time.

That avoids storing duplicated totals, but makes invoice list queries more expensive. For MVP, storing totals is acceptable if payment writes are transactional.

---

## 9.4 `GET /api/v1/patients/me/invoices`

Patient views own invoices.

### Actor

- Patient

### Schema Tables

- `invoices`
- `invoice_items`
- `payments`

### Response `200 OK`

Paginated invoice list.

### Why this design?

Patients need billing visibility without passing patient ID.

### Alternative considered

Use only `GET /invoices/{invoiceId}`.

That is not enough for invoice history.

---

## 9.5 `GET /api/v1/patients/me/payments`

Patient views own payment history.

### Actor

- Patient

### Schema Tables

- `payments`
- `invoices`

### Response `200 OK`

Paginated payment list.

### Why this design?

Payment history is a common patient billing view.

### Alternative considered

Show payments only inside invoices.

Useful, but a standalone payment history is still helpful for tracking.

---

## 10. Admin Basics

## 10.1 Admin Aliases

The MVP feature breakdown lists admin-specific endpoints:

```http
GET /api/v1/admin/users
POST /api/v1/admin/users
PATCH /api/v1/admin/users/{userId}/status
GET /api/v1/admin/patients
GET /api/v1/admin/appointments
GET /api/v1/admin/invoices
```

### Contract Decision

For implementation, prefer using the base resources with admin authorization:

```http
GET /api/v1/users
POST /api/v1/users
PATCH /api/v1/users/{userId}/status
GET /api/v1/patients
GET /api/v1/appointments
GET /api/v1/invoices
```

### Why this design?

It avoids duplicating admin and non-admin controller logic. The resource stays the same; permissions decide what the actor can see or do.

### Alternative considered

Use a full `/admin/*` namespace.

This can make admin UI routing obvious, but often duplicates backend logic. If the admin area becomes large later, we can introduce `/admin` routes as thin wrappers.

---

## 11. Cross-Cutting Contracts

## 11.1 Validation

Every write endpoint must validate request data before service execution.

Recommended Express pattern:

```text
route -> authenticate -> authorizeRole -> validateRequest -> controller -> service
```

### Why this design?

Invalid data should not reach business logic. This keeps services cleaner.

### Alternative considered

Validate directly inside controllers.

Acceptable for tiny projects, but it becomes repetitive and harder to test.

---

## 11.2 Authorization and Ownership

Role checks are not enough.

Example:

```text
Patient role can access /patients/me/reports.
But patient can only see reports where patient_reports.patient_id belongs to them.
```

### Why this design?

Healthcare data is sensitive. Access must check both role and record ownership/relationship.

### Alternative considered

Only check role.

Rejected because a patient role alone does not prove ownership of a specific record.

---

## 11.3 Transactions

Use database transactions for:

- Appointment booking
- Visit start
- Lab order creation from assigned tests
- Lab report upload and assigned test completion
- External report upload and assigned test completion
- Invoice creation with items
- Payment capture and invoice update

### Why this design?

These operations update related records. Partial completion would create inconsistent data.

### Implementation rule

Use the shared `withTransaction` helper from `db/transaction.js` for multi-query workflows. Repository methods should accept a `db` argument so the service can pass either the normal pool or the transaction client.

### Alternative considered

Run independent queries without transaction.

Simpler but unsafe when one write succeeds and another fails.

---

## 11.4 OpenAPI Contract

The machine-readable API contract lives in:

```text
docs/openapi.yaml
```

### Contract Rules

- Use OpenAPI 3.1.1 for the spec file.
- Keep `docs/mvp-api-contract.md` as the reasoning document and `docs/openapi.yaml` as the executable API contract.
- Use contract-first documentation for MVP; do not scatter the source of truth across route comments.
- Every protected endpoint must declare JWT bearer auth in OpenAPI.
- Public endpoints, such as register and login, must explicitly use `security: []`.
- Use shared OpenAPI schemas for common responses, pagination, IDs, timestamps, and error shapes.
- Do not include real patient data, real doctor data, real emails, or real report URLs in examples.
- Keep the OpenAPI file aligned whenever an endpoint contract changes.

### Why this design?

The value of OpenAPI in this project is a reviewable contract. It lets us check request bodies, response shapes, auth rules, and examples before controllers exist.

### Alternative considered

Generate docs from Express route comments.

Useful later, but rejected for MVP planning because our contract should lead implementation. Route comments can easily drift into scattered mini-contracts before the design is stable.

---

## 12. Suggested Implementation Order

1. API conventions and shared response/error model
2. Auth contracts
3. User/profile contracts
4. Appointment contracts
5. Visit and visit report contracts
6. Assigned tests and lab order contracts
7. Reports/documents contracts
8. Billing/payment contracts

This order follows dependency flow:

```text
Auth -> Profiles -> Appointments -> Visits -> Assigned Tests -> Lab/Reports -> Billing
```

---

## 13. Resolved MVP Review Decisions

These design questions are now resolved for MVP implementation:

| # | Decision | Reason |
|---:|---|---|
| 1 | Doctor browsing requires authentication. | Keeps the MVP authorization model simple and avoids maintaining public doctor discovery rules. |
| 2 | Completed visits are immutable. | Protects clinical history and keeps post-completion correction workflows out of MVP scope. |
| 3 | Prescribed medicines stay JSONB inside `visits`. | Avoids separate prescription tables/APIs until pharmacy, refills, or prescription analytics become real requirements. |
| 4 | Assigned tests support doctor-only cancellation. | Cancelling an assigned test changes the clinical plan, so the assigned doctor owns that action in MVP. |
| 5 | External report upload auto-completes the linked assigned test. | Reduces manual follow-up when a patient uploads an outside report for an assigned test. |
| 6 | Staff can book appointments for patients. | This supports front-desk workflows and is already reflected in `POST /api/v1/appointments`. |
| 7 | Invoices are auto-created after visit completion. | Avoids completed visits without invoices and removes a repetitive manual staff step. |
| 8 | Admin behavior uses normal resources with admin authorization. | Avoids duplicate `/admin/*` controllers while preserving admin-only permissions. |

### Finalized Phase 0 Tooling Decisions

Phase 0 finalized the setup choices that affect API implementation:

- Request validation uses `express-validator`.
- Validation chains should live in module-level `*.validators.js` files.
- A shared `validateRequest` middleware should format validation errors consistently.
- Schema changes use manual SQL migration files for MVP.
- Automated tests are introduced after the first module slice is built, using `jest`, `supertest`, and a separate `TEST_DATABASE_URL` for integration tests.
- Real database credentials belong only in local `.env`, never in committed docs, source, tests, or examples.
