# Healthcare Management System - Feature Breakdown

## 1. Document Purpose

This document breaks the Healthcare Management System (HMS) into production-oriented modules and feature areas.

The goal is to make the system easier to design, implement, test, and review by identifying:

- Business modules
- Actors involved in each module
- API resources
- Core actions and workflows
- Database tables involved
- Business rules
- Security and authorization requirements
- Testing considerations
- Suggested implementation phase

This document is based on the current user journey and PostgreSQL schema.

---

## 2. Primary Actors

### Patient

The patient is the healthcare consumer. A patient can manage their profile, search doctors, book appointments, attend consultations, view prescriptions, track tests, upload external reports, and pay invoices.

### Doctor

The doctor provides clinical care. A doctor manages schedule availability, views appointment queues, starts visits, records clinical information, prescribes medicines, orders tests, and reviews patient history where authorized.

### Staff

Staff users support operations such as appointment handling, lab workflow, report upload, billing support, and administrative back-office tasks depending on permissions.

### Admin

The admin manages users, operational configuration, master records, doctor/staff accounts, system-wide access, reporting, and sensitive administrative workflows.

---

## 3. Module Overview

| Module | Main Purpose | Primary Actors |
|---|---|---|
| Authentication and Access Control | Login, sessions, RBAC, audit logging | Patient, Doctor, Staff, Admin |
| User and Profile Management | Manage user accounts and role-specific profiles | Patient, Doctor, Staff, Admin |
| Doctor Discovery and Scheduling | Doctor search, availability, appointment booking | Patient, Staff, Doctor |
| Consultation and EMR | Visit lifecycle, notes, diagnosis, prescriptions, test assignment | Doctor, Patient |
| Lab and Diagnostics | Test catalog, lab orders, internal reports, external reports | Doctor, Patient, Staff |
| Patient Longitudinal Record | Unified patient history across appointments, visits, prescriptions, reports, tests | Patient, Doctor, Staff |
| Billing and Payments | Invoices, invoice items, payments, partial/due tracking | Patient, Staff, Admin |
| Admin and Operations | Master data, user administration, operational controls | Admin, Staff |
| Reporting and Analytics | Operational and financial dashboards | Admin, Staff |
| Cross-Cutting Platform Concerns | Validation, audit, soft delete, pagination, authorization, timezone safety | All modules |

---

## 4. Authentication and Access Control Module

### Purpose

This module establishes user identity, creates secure sessions, protects API routes, and enforces role-based and data-level authorization.

### Actors

- Patient
- Doctor
- Staff
- Admin

### Schema Tables

- `users`
- `refresh_sessions`
- `audit_logs`

### API Resources

#### `auth`

Represents authentication workflows.

Possible endpoints:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/logout-all`
- `GET /auth/me`

#### `sessions`

Represents user refresh/session records.

Possible endpoints:

- `GET /sessions`
- `DELETE /sessions/{sessionId}`

#### `audit-logs`

Represents security and operational audit records.

Possible endpoints:

- `GET /audit-logs`
- `GET /audit-logs/{auditLogId}`

### Features

- Register a new user when allowed by role policy
- Admin-created user accounts
- Login using email and password
- Password hashing before storage
- Access token creation
- Refresh token creation and rotation
- Logout by revoking current refresh session
- Logout from all devices
- Load current authenticated user
- Track last login timestamp
- Store device, browser, OS, and IP metadata for refresh sessions
- Record sensitive auth actions in audit logs

### Business Rules

- Email must be unique.
- Passwords must never be stored in plaintext.
- Inactive, flagged, or soft-deleted users cannot log in.
- Refresh tokens must be stored as hashes, not plaintext tokens.
- Logout should revoke the refresh session.
- Access to protected resources requires a valid token.
- Role checks happen before service execution.
- Data ownership checks happen after role checks and before returning records.

### Authorization Rules

| Action | Patient | Doctor | Staff | Admin |
|---|---:|---:|---:|---:|
| Login/logout | Yes | Yes | Yes | Yes |
| View own session list | Yes | Yes | Yes | Yes |
| Revoke own session | Yes | Yes | Yes | Yes |
| View all sessions | No | No | Limited | Yes |
| View audit logs | No | No | Limited | Yes |

### Security Notes

- Apply rate limiting on login, register, refresh, and password-related endpoints.
- Use short-lived access tokens.
- Rotate refresh tokens when refreshing sessions.
- Store refresh token hashes only.
- Avoid exposing whether an email exists during failed login.
- Log failed login attempts carefully without storing passwords.

### Test Plan

- Successful login with active user
- Login rejected for wrong password
- Login rejected for inactive user
- Refresh token creates a new access token
- Revoked refresh token cannot be reused
- Protected route rejects missing token
- Protected route rejects invalid role
- Audit log is created for login/logout/security-sensitive actions

### Implementation Phase

Phase 1.

Authentication and authorization should be implemented before other modules because every protected resource depends on authenticated identity and role context.

---

## 5. User and Profile Management Module

### Purpose

This module manages user accounts and role-specific profile records for patients, doctors, and staff.

### Actors

- Patient
- Doctor
- Staff
- Admin

### Schema Tables

- `users`
- `patient_profiles`
- `doctor_profiles`
- `staff_profiles`
- `audit_logs`

### API Resources

#### `users`

Represents account-level identity and access status.

Possible endpoints:

- `GET /users`
- `POST /users`
- `GET /users/{userId}`
- `PATCH /users/{userId}`
- `PATCH /users/{userId}/status`
- `DELETE /users/{userId}`

#### `patients`

Represents patient profile records.

Possible endpoints:

- `GET /patients`
- `POST /patients`
- `GET /patients/{patientId}`
- `PATCH /patients/{patientId}`
- `DELETE /patients/{patientId}`
- `GET /patients/me`
- `PATCH /patients/me`

#### `doctors`

Represents doctor profile records.

Possible endpoints:

- `GET /doctors`
- `POST /doctors`
- `GET /doctors/{doctorId}`
- `PATCH /doctors/{doctorId}`
- `DELETE /doctors/{doctorId}`
- `GET /doctors/me`
- `PATCH /doctors/me`

#### `staff`

Represents staff profile records.

Possible endpoints:

- `GET /staff`
- `POST /staff`
- `GET /staff/{staffId}`
- `PATCH /staff/{staffId}`
- `DELETE /staff/{staffId}`

### Features

- Create patient account and profile
- Create doctor account and profile
- Create staff account and profile
- Update account status
- Flag suspicious or problematic accounts
- Soft-delete users where retention is required
- Update patient demographic and medical profile data
- Update doctor specialty and credentials
- Update staff department and title
- View profile based on role and permission

### Business Rules

- A `user` must have exactly one primary role from the current enum model.
- A role-specific profile must reference a valid `users.id`.
- One user can have only one patient profile.
- One user can have only one doctor profile.
- One user can have only one staff profile.
- Soft-deleted users should not appear in normal list responses.
- Medical history should be preserved even if a profile is soft-deleted.
- Profile updates should update `updated_at`.

### Authorization Rules

| Action | Patient | Doctor | Staff | Admin |
|---|---:|---:|---:|---:|
| View own profile | Yes | Yes | Yes | Yes |
| Update own basic profile | Yes | Yes | Limited | Yes |
| Create doctor/staff user | No | No | No | Yes |
| Flag/deactivate users | No | No | Limited | Yes |
| View all patients | No | Limited | Yes | Yes |
| View all doctors | Yes | Yes | Yes | Yes |

### Production Notes

- Patient profile fields should be validated and normalized.
- Phone numbers should follow a consistent format.
- Gender and blood group should use enum validation.
- Credentials should remain structured in JSON, but the application should validate expected keys.
- Avoid allowing users to directly change their own role.

### Test Plan

- Create user with patient profile
- Create doctor profile for doctor role
- Prevent duplicate profile for same user
- Patient can update own profile
- Patient cannot update another patient's profile
- Admin can deactivate user
- Deactivated user cannot log in
- Soft-deleted profile is excluded from default list

### Implementation Phase

Phase 1.

Profiles are needed before appointments, visits, billing, and reports can reference real patient and doctor records.

---

## 6. Doctor Discovery and Scheduling Module

### Purpose

This module allows patients and staff to find doctors, inspect availability, book appointments, and manage appointment lifecycle changes safely.

### Actors

- Patient
- Doctor
- Staff
- Admin

### Schema Tables

- `doctor_profiles`
- `doctor_unavailability`
- `appointments`
- `users`
- `audit_logs`

### Important Schema Observation

The current journey mentions doctor working hours and availability slots, but the current MVP schema only includes `doctor_unavailability`.

That means availability may initially be computed from:

- Default clinic working hours from configuration
- Doctor active status
- Doctor unavailable slots
- Existing appointment conflicts

If per-doctor working hours are required, a future table such as `doctor_availability` or `doctor_working_hours` should be added.

### API Resources

#### `doctor-search`

Represents searchable doctor discovery.

Possible endpoints:

- `GET /doctor-search`
- `GET /doctor-search/suggestions`

Common query parameters:

- `specialty`
- `availableFrom`
- `availableTo`
- `date`
- `sort`
- `page`
- `limit`

#### `doctor-unavailability`

Represents doctor leave or blocked time.

Possible endpoints:

- `GET /doctors/{doctorId}/unavailability`
- `POST /doctors/{doctorId}/unavailability`
- `PATCH /doctors/{doctorId}/unavailability/{unavailabilityId}`
- `DELETE /doctors/{doctorId}/unavailability/{unavailabilityId}`

#### `appointments`

Represents appointment bookings between patients and doctors.

Possible endpoints:

- `GET /appointments`
- `POST /appointments`
- `GET /appointments/{appointmentId}`
- `PATCH /appointments/{appointmentId}`
- `POST /appointments/{appointmentId}/cancel`
- `POST /appointments/{appointmentId}/reschedule`
- `POST /appointments/{appointmentId}/mark-no-show`
- `GET /patients/{patientId}/appointments`
- `GET /doctors/{doctorId}/appointments`

#### `appointment-slots`

Represents computed available time slots.

Possible endpoints:

- `GET /doctors/{doctorId}/available-slots`
- `GET /appointment-slots`

### Features

- Search doctors by specialty
- Search doctors by availability
- Sort doctors by popularity or utilization when available
- View doctor profile details
- Compute available slots
- Book appointment
- Book appointment on behalf of patient by staff
- Cancel appointment
- Reschedule appointment
- Mark appointment as completed after visit
- Mark appointment as no-show by policy
- Track who booked the appointment

### Business Rules

- Appointment `start_at` must be earlier than `end_at`.
- A doctor cannot have overlapping scheduled appointments.
- A doctor cannot be booked during unavailable time.
- Booking must perform final conflict checks inside the transaction.
- UI availability is only a convenience; backend conflict check is authoritative.
- Cancelled appointments should keep cancellation reason.
- Reschedule should re-run all booking validations.
- Completed appointments should not be cancelled by normal users.
- Appointment status must follow valid transitions.

### Suggested Appointment Status Transitions

| Current Status | Allowed Next Status |
|---|---|
| `scheduled` | `completed`, `cancelled`, `no_show` |
| `completed` | Final |
| `cancelled` | Final |
| `no_show` | Final |

If rescheduling needs historical tracking, avoid using only an appointment status. Prefer either:

- Update same appointment with new time and audit log
- Or cancel old appointment and create a new appointment
- Or add `appointment_status_history` in a later phase

### Authorization Rules

| Action | Patient | Doctor | Staff | Admin |
|---|---:|---:|---:|---:|
| Search doctors | Yes | Yes | Yes | Yes |
| View available slots | Yes | Yes | Yes | Yes |
| Book own appointment | Yes | No | Yes | Yes |
| Book for any patient | No | No | Yes | Yes |
| View own appointments | Yes | Yes | Yes | Yes |
| Cancel own appointment | Yes | No | Yes | Yes |
| Manage own unavailability | No | Yes | Limited | Yes |
| Mark no-show | No | Yes | Yes | Yes |

### Performance Notes

- Indexes already support appointment lookup by doctor and start time.
- Available slot calculation can become expensive as appointment volume grows.
- Use pagination for appointment lists.
- Filter by date range whenever possible.
- Popularity metrics should initially be computed from completed appointments.
- Later, high-traffic systems may need cached slot availability or materialized metrics.

### Security Notes

- Patients should not see other patients' appointment details.
- Doctors should only see appointments assigned to them.
- Staff access should be permission-limited.
- Cancellation and reschedule actions should be audit logged.

### Test Plan

- Book valid appointment
- Reject appointment when doctor has overlapping appointment
- Reject appointment during doctor unavailability
- Patient can view own appointment
- Patient cannot view another patient's appointment
- Doctor can view assigned appointments
- Reschedule appointment into valid slot
- Reject reschedule into conflict
- Cancel appointment with reason
- Prevent invalid status transition

### Implementation Phase

Phase 2.

Scheduling should come after auth and profiles because appointments depend on patient and doctor records.

---

## 7. Consultation and EMR Module

### Purpose

This module manages clinical visits, diagnosis, symptoms, notes, prescriptions, and test assignment.

### Actors

- Doctor
- Patient
- Staff
- Admin

### Schema Tables

- `appointments`
- `visits`
- `prescriptions`
- `prescription_items`
- `lab_orders`
- `lab_order_items`
- `test_catalog`
- `audit_logs`

### API Resources

#### `visits`

Represents a clinical encounter between patient and doctor.

Possible endpoints:

- `GET /visits`
- `POST /visits`
- `GET /visits/{visitId}`
- `PATCH /visits/{visitId}`
- `POST /visits/{visitId}/start`
- `POST /visits/{visitId}/ready-for-closure`
- `POST /visits/{visitId}/complete`
- `POST /visits/{visitId}/flag`
- `GET /patients/{patientId}/visits`
- `GET /doctors/{doctorId}/visits`

#### `prescriptions`

Represents a prescription created during a visit.

Possible endpoints:

- `GET /visits/{visitId}/prescriptions`
- `POST /visits/{visitId}/prescriptions`
- `GET /prescriptions/{prescriptionId}`
- `PATCH /prescriptions/{prescriptionId}`
- `DELETE /prescriptions/{prescriptionId}`

#### `prescription-items`

Represents medicines in a prescription.

Possible endpoints:

- `POST /prescriptions/{prescriptionId}/items`
- `PATCH /prescriptions/{prescriptionId}/items/{itemId}`
- `DELETE /prescriptions/{prescriptionId}/items/{itemId}`

#### `visit-test-orders`

Represents tests assigned during a visit.

Possible endpoints:

- `POST /visits/{visitId}/lab-orders`
- `GET /visits/{visitId}/lab-orders`

### Features

- Start visit from scheduled appointment
- Create visit without appointment when policy allows walk-in visits
- Record symptoms
- Record diagnoses
- Record clinical notes
- Add prescription
- Add prescription medicines
- Assign lab tests
- Move visit to ready for closure
- Complete visit after billing checkpoint
- Flag visit for administrative or clinical review
- Expose visit summary to authorized patient
- Expose patient history to authorized doctor

### Business Rules

- One appointment can have at most one visit.
- A visit must reference a patient and doctor.
- A scheduled appointment should be the normal source of a visit.
- Only the assigned doctor should update clinical notes.
- Prescription items must belong to a prescription.
- A prescription must belong to a visit.
- Lab orders created from a visit should reference that visit.
- Visit completion should set `end_at`.
- Billing should be checked before final visit closure when required by policy.

### Suggested Visit Status Transitions

| Current Status | Allowed Next Status |
|---|---|
| `in_progress` | `ready_for_closure`, `flagged` |
| `ready_for_closure` | `completed`, `flagged` |
| `flagged` | `in_progress`, `ready_for_closure`, `completed` |
| `completed` | Final for normal editing |

### Authorization Rules

| Action | Patient | Doctor | Staff | Admin |
|---|---:|---:|---:|---:|
| View own visit summary | Yes | No | Limited | Yes |
| View assigned patient visit | No | Yes | Limited | Yes |
| Start visit | No | Assigned doctor | No | Yes |
| Edit clinical notes | No | Assigned doctor | No | Limited |
| Add prescription | No | Assigned doctor | No | Limited |
| Complete visit | No | Assigned doctor | Limited | Yes |
| View prescriptions | Own only | Assigned/authorized | Limited | Yes |

### Production Notes

- Clinical information is sensitive and should be tightly permissioned.
- Avoid returning internal-only notes to patients unless explicitly allowed.
- Use JSONB for symptoms and diagnoses initially, but validate shape at API boundary.
- Consider structured diagnosis coding in later phases if needed.
- Completed visits should be immutable or require special permission to edit.

### Test Plan

- Start visit for scheduled appointment
- Prevent second visit for same appointment
- Doctor can update assigned visit
- Doctor cannot update another doctor's visit
- Patient can view permitted visit summary
- Patient cannot edit visit
- Add prescription with multiple medicines
- Reject prescription item missing medicine name
- Assign lab tests from test catalog
- Complete visit only from valid status

### Implementation Phase

Phase 3.

Consultation depends on appointments, patients, doctors, and test catalog.

---

## 8. Lab and Diagnostics Module

### Purpose

This module manages diagnostic test definitions, lab orders, lab order item status, internal report upload, and links external reports into the patient record.

### Actors

- Doctor
- Patient
- Staff
- Admin

### Schema Tables

- `test_catalog`
- `lab_orders`
- `lab_order_items`
- `lab_reports`
- `patient_reports`
- `report_attachments`
- `visits`
- `audit_logs`

### API Resources

#### `test-catalog`

Represents available diagnostic tests.

Possible endpoints:

- `GET /test-catalog`
- `POST /test-catalog`
- `GET /test-catalog/{testId}`
- `PATCH /test-catalog/{testId}`
- `DELETE /test-catalog/{testId}`

#### `lab-orders`

Represents diagnostic orders for patients.

Possible endpoints:

- `GET /lab-orders`
- `POST /lab-orders`
- `GET /lab-orders/{labOrderId}`
- `PATCH /lab-orders/{labOrderId}`
- `POST /lab-orders/{labOrderId}/cancel`
- `GET /patients/{patientId}/lab-orders`
- `GET /visits/{visitId}/lab-orders`

#### `lab-order-items`

Represents individual tests inside a lab order.

Possible endpoints:

- `GET /lab-orders/{labOrderId}/items`
- `POST /lab-orders/{labOrderId}/items`
- `PATCH /lab-orders/{labOrderId}/items/{itemId}`
- `POST /lab-orders/{labOrderId}/items/{itemId}/status`

#### `lab-reports`

Represents internal lab report results.

Possible endpoints:

- `GET /lab-reports`
- `POST /lab-orders/{labOrderId}/reports`
- `POST /lab-order-items/{itemId}/reports`
- `GET /lab-reports/{labReportId}`
- `PATCH /lab-reports/{labReportId}`

#### `patient-reports`

Represents internal or external patient documents.

Possible endpoints:

- `GET /patients/{patientId}/reports`
- `POST /patients/{patientId}/reports`
- `GET /patient-reports/{reportId}`
- `PATCH /patient-reports/{reportId}`
- `DELETE /patient-reports/{reportId}`
- `POST /patient-reports/{reportId}/attachments`
- `DELETE /report-attachments/{attachmentId}`

### Features

- Manage test catalog
- Create lab order from doctor-assigned tests
- Track lab order lifecycle
- Track individual lab item lifecycle
- Upload internal lab report
- Attach report file or URL
- Store structured report data in JSONB
- Patient uploads external report
- Link reports to visits or lab orders
- Patient and doctor can view reports based on access policy

### Business Rules

- Test names must be unique.
- Test prices cannot be negative.
- Lab order must belong to a patient.
- Lab order can optionally reference doctor and visit.
- Lab order item must reference a valid test catalog item.
- A lab order cannot contain the same test twice.
- Lab report must link to either lab order or lab order item.
- Patient report source must be either `internal` or `external`.
- Report attachment must have either `storage_key` or `url`.

### Suggested Lab Status Transitions

| Current Status | Allowed Next Status |
|---|---|
| `requested` | `sample_collected`, `cancelled` |
| `sample_collected` | `processing`, `cancelled` |
| `processing` | `completed`, `cancelled` |
| `completed` | Final |
| `cancelled` | Final |

### Authorization Rules

| Action | Patient | Doctor | Staff | Admin |
|---|---:|---:|---:|---:|
| View own lab orders | Yes | No | Limited | Yes |
| View assigned patient lab orders | No | Yes | Yes | Yes |
| Create lab order | No | Yes | Limited | Yes |
| Update lab status | No | No | Yes | Yes |
| Upload internal lab report | No | No | Yes | Yes |
| Upload external report | Own only | No | Limited | Yes |
| Manage test catalog | No | No | Limited | Yes |

### Production Notes

- File upload should validate MIME type and file size.
- Storage keys should not expose private bucket internals directly if using private storage.
- Report access should be permission-controlled.
- Lab reports may require immutable history in a future phase.
- Test catalog deletion should be restricted if used by historical lab order items.

### Test Plan

- Create test catalog item
- Reject duplicate test name
- Reject negative test price
- Create lab order from visit
- Add lab order items
- Reject duplicate test in same lab order
- Update lab item status through valid lifecycle
- Reject invalid lab status transition
- Upload internal lab report
- Upload external patient report
- Patient can view own reports
- Patient cannot view another patient's reports

### Implementation Phase

Phase 4.

Lab features depend on visits, test catalog, patients, doctors, and document handling.

---

## 9. Patient Longitudinal Record Module

### Purpose

This module provides a unified patient history across appointments, visits, prescriptions, lab tests, billing references, and reports.

### Actors

- Patient
- Doctor
- Staff
- Admin

### Schema Tables

- `patient_profiles`
- `appointments`
- `visits`
- `prescriptions`
- `prescription_items`
- `lab_orders`
- `lab_order_items`
- `lab_reports`
- `patient_reports`
- `report_attachments`
- `invoices`
- `payments`

### API Resources

#### `patient-records`

Represents the aggregated longitudinal patient view.

Possible endpoints:

- `GET /patients/{patientId}/record`
- `GET /patients/{patientId}/timeline`
- `GET /patients/{patientId}/summary`
- `GET /patients/me/record`
- `GET /patients/me/timeline`

#### `patient-history`

Represents filtered historical sections.

Possible endpoints:

- `GET /patients/{patientId}/history/appointments`
- `GET /patients/{patientId}/history/visits`
- `GET /patients/{patientId}/history/prescriptions`
- `GET /patients/{patientId}/history/lab-tests`
- `GET /patients/{patientId}/history/reports`
- `GET /patients/{patientId}/history/invoices`

### Features

- Patient profile summary
- Appointment timeline
- Visit timeline
- Prescription history
- Lab order and test history
- Internal report repository
- External report repository
- Billing summary
- Patient-facing summary view
- Doctor-facing clinical history view
- Staff/admin operational view

### Business Rules

- Patient can access only their own longitudinal record.
- Doctor access must be based on assignment or explicit policy.
- Staff access should be purpose-limited.
- Sensitive clinical notes may have different visibility rules from patient-facing summaries.
- Timeline responses should be sorted consistently by event time.
- Large historical sections should be paginated.

### Authorization Rules

| Action | Patient | Doctor | Staff | Admin |
|---|---:|---:|---:|---:|
| View own record | Yes | No | No | Yes |
| View assigned patient record | No | Yes | Limited | Yes |
| View all patient records | No | No | Limited | Yes |
| View billing section | Own only | No | Limited | Yes |
| View clinical notes | Limited | Assigned/authorized | Limited | Yes |

### Production Notes

- This module should mostly use read models and query services.
- Avoid one massive query that becomes hard to maintain.
- Use clear response sections.
- Paginate heavy subsections such as reports, visits, and invoices.
- Consider separate DTOs for patient-facing and doctor-facing versions.

### Test Plan

- Patient can fetch own timeline
- Patient cannot fetch another patient's timeline
- Doctor can fetch assigned patient's clinical history
- Doctor cannot fetch unrelated patient history
- Timeline returns appointments, visits, prescriptions, labs, and reports in expected order
- Pagination works for large report/history lists

### Implementation Phase

Phase 4 or Phase 5.

Basic history can start early, but the complete longitudinal record becomes useful after appointments, visits, labs, and billing exist.

---

## 10. Billing and Payments Module

### Purpose

This module handles consultation and service invoices, line items, payment capture, partial payments, due tracking, and payment history.

### Actors

- Patient
- Staff
- Admin
- Doctor, limited visibility only if policy allows

### Schema Tables

- `invoices`
- `invoice_items`
- `payments`
- `patient_profiles`
- `visits`
- `audit_logs`

### API Resources

#### `invoices`

Represents a bill issued to a patient.

Possible endpoints:

- `GET /invoices`
- `POST /invoices`
- `GET /invoices/{invoiceId}`
- `PATCH /invoices/{invoiceId}`
- `POST /invoices/{invoiceId}/void`
- `GET /patients/{patientId}/invoices`
- `GET /visits/{visitId}/invoice`

#### `invoice-items`

Represents billable line items.

Possible endpoints:

- `GET /invoices/{invoiceId}/items`
- `POST /invoices/{invoiceId}/items`
- `PATCH /invoices/{invoiceId}/items/{itemId}`
- `DELETE /invoices/{invoiceId}/items/{itemId}`

#### `payments`

Represents money received against an invoice.

Possible endpoints:

- `GET /payments`
- `POST /invoices/{invoiceId}/payments`
- `GET /payments/{paymentId}`
- `GET /patients/{patientId}/payments`

#### `receipts`

Represents payment confirmation output.

Possible endpoints:

- `GET /payments/{paymentId}/receipt`
- `GET /invoices/{invoiceId}/receipt`

### Features

- Generate invoice from visit
- Add consultation fee line item
- Add test or service line items
- Calculate total amount
- Calculate paid amount
- Calculate due amount
- Accept full payment
- Accept partial payment
- Track invoice status
- Void invoice when allowed
- View patient billing history
- Generate receipt
- Record payment receiver

### Business Rules

- Invoice total cannot be negative.
- Paid amount cannot be greater than total amount.
- Due amount should equal total amount minus paid amount.
- Payment amount must be greater than zero.
- Invoice item quantity must be greater than zero.
- Invoice item unit price cannot be negative.
- Invoice item amount must equal quantity multiplied by unit price.
- Paid invoice should not accept extra payments.
- Void invoice should not accept payments.
- Payment capture should update invoice paid and due amounts atomically.

### Important Schema Observation

The current schema has this check commented out:

```sql
-- CHECK (due_amount = total_amount - paid_amount)
```

At application level, the billing service must still enforce this invariant. In a later schema refinement, this could be restored using a generated column or handled through database triggers depending on the chosen design.

### Suggested Invoice Status Rules

| Condition | Status |
|---|---|
| `paid_amount = 0` and `total_amount > 0` | `pending` |
| `paid_amount > 0` and `paid_amount < total_amount` | `partial` |
| `paid_amount = total_amount` | `paid` |
| Invoice cancelled administratively | `void` |

### Authorization Rules

| Action | Patient | Doctor | Staff | Admin |
|---|---:|---:|---:|---:|
| View own invoices | Yes | No | Yes | Yes |
| Create invoice | No | No | Yes | Yes |
| Add invoice item | No | No | Yes | Yes |
| Record payment | Limited/online | No | Yes | Yes |
| Void invoice | No | No | Limited | Yes |
| View revenue reports | No | No | Limited | Yes |

### Production Notes

- Payment operations must be transactional.
- Avoid floating point types for money. The schema correctly uses `NUMERIC`.
- Online payment integrations should not be considered successful until provider confirmation.
- Use idempotency keys for online payment callbacks in a later phase.
- Audit invoice voids and payment captures.

### Test Plan

- Generate invoice for visit
- Add valid invoice items
- Reject invoice item with invalid amount
- Capture full payment
- Capture partial payment
- Update invoice status to `partial`
- Update invoice status to `paid`
- Prevent payment above due amount
- Prevent payment on void invoice
- Patient can view own invoices
- Patient cannot view another patient's invoice

### Implementation Phase

Phase 5.

Billing should be implemented after consultation and lab basics because invoices depend on visits, consultation fees, and possibly test/service charges.

---

## 11. Admin and Operations Module

### Purpose

This module provides administrative control over users, master records, operational workflows, and system governance.

### Actors

- Admin
- Staff

### Schema Tables

- `users`
- `patient_profiles`
- `doctor_profiles`
- `staff_profiles`
- `test_catalog`
- `doctor_unavailability`
- `appointments`
- `lab_orders`
- `invoices`
- `audit_logs`

### API Resources

#### `admin-users`

Possible endpoints:

- `GET /admin/users`
- `POST /admin/users`
- `GET /admin/users/{userId}`
- `PATCH /admin/users/{userId}`
- `PATCH /admin/users/{userId}/status`

#### `admin-master-data`

Possible endpoints:

- `GET /admin/test-catalog`
- `POST /admin/test-catalog`
- `PATCH /admin/test-catalog/{testId}`

#### `admin-operations`

Possible endpoints:

- `GET /admin/appointments`
- `GET /admin/lab-orders`
- `GET /admin/invoices`
- `GET /admin/audit-logs`

### Features

- Create users by role
- Edit user status
- Flag account
- Deactivate account
- Manage doctor profiles
- Manage staff profiles
- Manage patient records where policy allows
- Manage test catalog
- View appointment operations
- View lab operations
- View billing operations
- View audit logs

### Business Rules

- Admin actions must be audit logged.
- Admin should not accidentally hard-delete records with historical value.
- Staff operations should be permission-limited.
- Master data changes should not break historical records.
- Deactivating a doctor should prevent future bookings but preserve history.

### Authorization Rules

Admin has broad access, but production systems should still separate permissions such as:

- User management
- Billing management
- Lab management
- Reports access
- Audit log access
- Master data management

This can start as role-based access and later evolve into permission-based access if needed.

### Production Notes

- Avoid building admin features as unrestricted shortcuts around domain rules.
- Admin operations should reuse domain services where possible.
- Audit logs should include actor, action, entity type, entity id, and metadata.

### Test Plan

- Admin can create doctor user
- Admin can deactivate doctor
- Deactivated doctor does not appear as bookable
- Staff cannot perform admin-only user management
- Admin action creates audit log
- Test catalog updates preserve historical lab item references

### Implementation Phase

Phase 1 through Phase 6.

Some admin functions are required early, while advanced operations can be added module by module.

---

## 12. Reporting and Analytics Module

### Purpose

This module provides operational and business insights for administrators and staff.

### Actors

- Admin
- Staff

### Schema Tables

- `appointments`
- `visits`
- `doctor_profiles`
- `patient_profiles`
- `lab_orders`
- `invoices`
- `invoice_items`
- `payments`

### API Resources

#### `reports`

Represents report generation APIs.

Possible endpoints:

- `GET /reports/daily-appointments`
- `GET /reports/revenue-summary`
- `GET /reports/doctor-utilization`
- `GET /reports/doctor-popularity`
- `GET /reports/patient-visit-frequency`
- `GET /reports/patient-doctor-affinity`

#### `dashboard`

Represents dashboard summary feeds.

Possible endpoints:

- `GET /dashboard/admin`
- `GET /dashboard/staff`
- `GET /dashboard/doctor`
- `GET /dashboard/patient`

### Features

- Daily appointment count
- Appointment status breakdown
- Revenue summary
- Paid versus due amount
- Doctor utilization
- Doctor popularity
- Patient visit frequency
- Patient-doctor affinity
- Lab order status summary
- Operational dashboard cards

### Business Rules

- Reports should always require date range filters where appropriate.
- Revenue should be based on payment records, not only invoice totals.
- Doctor popularity should define a clear calculation method.
- Cancelled and no-show appointments should be handled separately from completed appointments.
- Dashboard data should respect the actor's access scope.

### Initial Metrics

#### Daily Appointments

Source:

- `appointments`

Dimensions:

- Date
- Doctor
- Status

#### Revenue Summary

Source:

- `payments`
- `invoices`

Dimensions:

- Date range
- Payment method
- Invoice status

#### Doctor Utilization

Source:

- `appointments`
- `visits`
- `doctor_unavailability`

Initial calculation:

- Completed appointments per doctor in date range
- Scheduled appointment hours versus configured available hours

#### Doctor Popularity

Source:

- `appointments`

Initial calculation:

- Count of completed appointments per doctor in date range

Future calculation may include:

- Ratings
- Repeat patients
- Cancellation rate
- Specialty ranking

#### Patient Visit Frequency

Source:

- `visits`

Calculation:

- Visit count per patient in date range

#### Patient-Doctor Affinity

Source:

- `appointments`
- `visits`

Calculation:

- Repeated completed visits between same patient and doctor

### Authorization Rules

| Action | Patient | Doctor | Staff | Admin |
|---|---:|---:|---:|---:|
| Patient dashboard | Own only | No | Limited | Yes |
| Doctor dashboard | No | Own only | Limited | Yes |
| Operational dashboard | No | No | Yes | Yes |
| Revenue reports | No | No | Limited | Yes |
| Audit/security reports | No | No | No | Yes |

### Performance Notes

- Start with live queries for MVP.
- Add indexes based on actual slow queries.
- Use materialized views or summary tables only after real performance need appears.
- Always paginate drill-down report rows.
- Cache dashboard summaries only if data freshness requirements allow it.

### Test Plan

- Daily appointment report filters by date range
- Revenue report uses payments
- Doctor utilization excludes cancelled appointments
- Doctor popularity counts completed appointments
- Patient visit frequency respects date range
- Staff cannot access admin-only financial reports if not permitted

### Implementation Phase

Phase 6.

Reporting is most valuable after transactional modules produce enough data.

---

## 13. Cross-Cutting Production Concerns

### Validation

Every write endpoint should validate:

- Required fields
- Field type
- Enum values
- Date ordering
- Numeric constraints
- Ownership and foreign key existence
- Status transition validity

### Error Handling

Use predictable error responses:

- `400 Bad Request` for validation errors
- `401 Unauthorized` for missing or invalid authentication
- `403 Forbidden` for valid identity without permission
- `404 Not Found` for missing or inaccessible resources
- `409 Conflict` for booking conflicts, duplicate records, and state conflicts
- `422 Unprocessable Entity` for valid JSON that violates domain rules

### Audit Logging

Audit these events at minimum:

- Login/logout security events
- User status changes
- Profile updates
- Appointment booking, cancellation, reschedule
- Visit completion
- Lab report upload
- Invoice creation
- Payment capture
- Invoice void

### Soft Delete

Use soft delete for:

- Users
- Patient profiles
- Doctor profiles
- Staff profiles

Avoid hard delete for records with clinical, billing, or audit value.

### Pagination

Use pagination for:

- Users
- Patients
- Doctors
- Appointments
- Visits
- Lab orders
- Reports
- Invoices
- Payments
- Audit logs

### Timezone Handling

All timestamps should be stored as `TIMESTAMPTZ`.

API clients should be clear about:

- Input timezone
- Display timezone
- Clinic operating timezone
- Date range boundaries

### Transactional Safety

Use database transactions for:

- Appointment booking conflict check plus create
- Appointment reschedule
- Visit completion plus appointment update
- Invoice creation plus invoice items
- Payment capture plus invoice amount update
- Lab order creation plus lab items

### Data Ownership

Role-based access is not enough for healthcare data.

Every sensitive read should also check record ownership or assignment:

- Patient owns their records
- Doctor is assigned through appointment/visit relationship
- Staff has explicit operational permission
- Admin has broad but audited access

---

## 14. Recommended API Resource Map

| Resource | Module | Main Table or Model |
|---|---|---|
| `auth` | Authentication | `users`, `refresh_sessions` |
| `sessions` | Authentication | `refresh_sessions` |
| `users` | User Management | `users` |
| `patients` | Profile Management | `patient_profiles` |
| `doctors` | Profile Management | `doctor_profiles` |
| `staff` | Profile Management | `staff_profiles` |
| `doctor-search` | Discovery | `doctor_profiles`, computed availability |
| `doctor-unavailability` | Scheduling | `doctor_unavailability` |
| `appointment-slots` | Scheduling | computed model |
| `appointments` | Scheduling | `appointments` |
| `visits` | Consultation | `visits` |
| `prescriptions` | Consultation | `prescriptions` |
| `prescription-items` | Consultation | `prescription_items` |
| `test-catalog` | Lab | `test_catalog` |
| `lab-orders` | Lab | `lab_orders` |
| `lab-order-items` | Lab | `lab_order_items` |
| `lab-reports` | Lab | `lab_reports` |
| `patient-reports` | Reports/Documents | `patient_reports` |
| `report-attachments` | Reports/Documents | `report_attachments` |
| `patient-records` | Longitudinal Record | aggregated read model |
| `invoices` | Billing | `invoices` |
| `invoice-items` | Billing | `invoice_items` |
| `payments` | Billing | `payments` |
| `receipts` | Billing | generated output/read model |
| `reports` | Analytics | query/read model |
| `dashboard` | Analytics | query/read model |
| `audit-logs` | Platform/Admin | `audit_logs` |

---

## 15. Suggested Implementation Phases

### Phase 1: Foundation

Build:

- Auth
- RBAC middleware
- User management
- Patient profile
- Doctor profile
- Staff profile
- Basic audit logging

Why:

Every other module depends on authenticated users and role-specific profiles.

### Phase 2: Scheduling

Build:

- Doctor search
- Doctor unavailability
- Available slot calculation
- Appointment booking
- Appointment cancellation
- Appointment rescheduling

Why:

Appointments are the bridge between patients and doctors and are required before visits.

### Phase 3: Consultation and EMR

Build:

- Visit start
- Symptoms, diagnoses, and notes
- Prescriptions
- Prescription items
- Test assignment from visit
- Visit completion lifecycle

Why:

This is the clinical core of the system.

### Phase 4: Lab and Patient Documents

Build:

- Test catalog
- Lab orders
- Lab order items
- Lab status workflow
- Internal lab report upload
- External patient report upload
- Report attachment management

Why:

Lab workflows extend consultation and feed the patient longitudinal record.

### Phase 5: Billing and Payments

Build:

- Invoice generation
- Invoice items
- Full payment
- Partial payment
- Due tracking
- Receipt view

Why:

Billing depends on visits and service/test charges.

### Phase 6: Reporting and Analytics

Build:

- Admin dashboard
- Daily appointment reports
- Revenue reports
- Doctor utilization/popularity
- Patient visit frequency
- Operational summaries

Why:

Analytics should be built after real transactional data exists.

---

## 16. Suggested Detailed Phase Plan

### Phase 1 Detail: Foundation

#### Backend Resources

- `auth`
- `users`
- `patients`
- `doctors`
- `staff`
- `sessions`
- `audit-logs`

#### Core Services

- Auth service
- Token service
- Password hashing service
- User service
- Profile service
- RBAC guard
- Audit log service

#### Important Tests

- Login success/failure
- Token validation
- Role restriction
- Profile ownership
- User deactivation
- Duplicate email prevention

### Phase 2 Detail: Scheduling

#### Backend Resources

- `doctor-search`
- `doctor-unavailability`
- `appointment-slots`
- `appointments`

#### Core Services

- Doctor search service
- Slot calculation service
- Appointment booking service
- Appointment lifecycle service

#### Important Tests

- Slot generation
- Conflict prevention
- Unavailability prevention
- Patient appointment ownership
- Doctor appointment visibility
- Reschedule validation

### Phase 3 Detail: Consultation and EMR

#### Backend Resources

- `visits`
- `prescriptions`
- `prescription-items`
- `visit-test-orders`

#### Core Services

- Visit service
- Prescription service
- Clinical record access policy
- Test assignment service

#### Important Tests

- Start visit from appointment
- Prevent duplicate visit
- Doctor-only clinical update
- Prescription item validation
- Visit status transition validation

### Phase 4 Detail: Lab and Documents

#### Backend Resources

- `test-catalog`
- `lab-orders`
- `lab-order-items`
- `lab-reports`
- `patient-reports`
- `report-attachments`

#### Core Services

- Test catalog service
- Lab order service
- Lab status service
- Report upload service
- Report access policy

#### Important Tests

- Lab order creation
- Lab status transitions
- Internal report upload
- External report upload
- Report ownership
- Attachment validation

### Phase 5 Detail: Billing

#### Backend Resources

- `invoices`
- `invoice-items`
- `payments`
- `receipts`

#### Core Services

- Invoice service
- Payment service
- Receipt service
- Billing policy service

#### Important Tests

- Invoice total calculation
- Partial payment
- Full payment
- Due calculation
- Prevent overpayment
- Prevent payment on void invoice

### Phase 6 Detail: Reporting

#### Backend Resources

- `reports`
- `dashboard`

#### Core Services

- Appointment report service
- Revenue report service
- Doctor analytics service
- Patient analytics service
- Dashboard query service

#### Important Tests

- Date range filtering
- Correct revenue source
- Correct appointment status grouping
- Role-based report access
- Pagination on drill-down data

---

## 17. Open Design Decisions

These questions should be answered before implementation reaches the related modules.

### Scheduling

- Will doctors have fixed working hours in the database?
- Will appointment duration be global, per specialty, or per doctor?
- Should reschedule preserve history in a separate table?

### Clinical Records

- Which visit notes are visible to patients?
- Can doctors edit completed visits?
- Should symptoms and diagnoses remain JSONB or become normalized tables later?

### Lab

- Can patients choose internal versus external testing per test item?
- Should external reports be linked to a doctor-assigned test?
- Should lab report edits keep revision history?

### Billing

- Is consultation payment required before visit completion?
- Can patients pay online in MVP, or is payment recorded manually?
- Who is allowed to void invoices?

### Authorization

- Is role-based access enough for MVP?
- Do staff need granular permissions?
- Should doctor-patient access expire after a visit?

---

## 18. Recommended Next Step

Before coding, convert this breakdown into API contracts module by module.

Recommended first API contract documents:

1. Auth and RBAC API contract
2. User/Profile API contract
3. Appointment/Scheduling API contract
4. Visit/Prescription API contract
5. Lab/Reports API contract
6. Billing API contract

This keeps implementation focused and makes it easier to build production-grade modules incrementally.
