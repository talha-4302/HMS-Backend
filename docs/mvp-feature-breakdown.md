# HMS MVP Feature Breakdown

## 1. MVP Goal

The MVP goal is to build the smallest production-quality version of the Healthcare Management System that supports the core hospital flow:

1. Users log in based on role.
2. Patients and doctors have profiles.
3. Patients book appointments with doctors.
4. Doctors conduct consultations.
5. Doctors record prescribed medicines and assign tests during consultations.
6. Patients can view visit reports, assigned tests, uploaded reports, appointments, and bills.
7. Staff/admin can manage basic lab, billing, and user operations.

This MVP should be simple enough to implement in phases, but structured well enough to grow later.

---

## 2. MVP Actors

## Patient

The patient can:

- Register or log in
- Complete profile
- Search doctors
- Book appointments
- View appointment history
- View visit reports
- View assigned tests
- Order assigned tests at the hospital
- Upload external reports
- View invoices and payment status

## Doctor

The doctor can:

- Log in
- Complete profile
- Manage unavailable times
- View appointments
- Start consultation
- Add symptoms, diagnosis, and notes
- Add prescribed medicines inside the visit
- Assign tests during the visit
- Complete visit

## Staff

The staff user can:

- Help manage appointments
- Update lab test status
- Upload internal lab reports
- Record payments

## Admin

The admin can:

- Create and manage users
- Manage doctor, patient, and staff records
- Manage test catalog
- View basic operational data

---

## 3. MVP Modules

| Module | Purpose | Main Actors |
|---|---|---|
| Auth and Roles | Login, sessions, role-based access | All |
| User/Profile Management | Manage patient, doctor, staff profiles | All |
| Doctor Discovery | Let patients find doctors | Patient |
| Appointment Booking | Book, cancel, and view appointments | Patient, Doctor, Staff |
| Consultation and Visit Report | Doctor records visit details, medicines, and assigned tests | Doctor, Patient |
| Lab Tests | Patient orders assigned tests at hospital, staff updates status | Patient, Staff |
| Reports/Documents | Internal and external reports | Patient, Staff, Doctor |
| Billing | Invoice and payment tracking | Staff, Patient, Admin |
| Admin Basics | User and master data management | Admin |

---

## 4. Auth and Roles

## Purpose

Authenticate users and protect API endpoints based on role.

## MVP Features

- Login with email/password
- Register patient account
- Admin creates doctor/staff accounts
- Generate access token
- Optional refresh token support
- Logout
- Get current user
- Block inactive users

## Schema Tables

- `users`
- `refresh_sessions`

## API Resources

| Resource | Endpoint | Purpose |
|---|---|---|
| `auth` | `POST /auth/register` | Patient registration |
| `auth` | `POST /auth/login` | User login |
| `auth` | `POST /auth/logout` | User logout |
| `auth` | `POST /auth/refresh` | Refresh access token |
| `auth` | `GET /auth/me` | Get current logged-in user |

## MVP Rules

- Passwords must be hashed.
- Email must be unique.
- Only active users can log in.
- Every protected route must require authentication.
- Role should be checked before allowing protected actions.

## Keep Out of MVP

- Full permission matrix
- Multi-role users
- Password reset
- MFA
- Advanced session device management

---

## 5. User and Profile Management

## Purpose

Store role-specific profile information for patients, doctors, and staff.

## MVP Features

- Patient creates/updates own profile
- Doctor updates own profile
- Admin creates doctor/staff users
- Admin can deactivate users
- View doctor list
- View patient details by authorized users

## Schema Tables

- `users`
- `patient_profiles`
- `doctor_profiles`
- `staff_profiles`

## API Resources

| Resource | Endpoint | Purpose |
|---|---|---|
| `users` | `GET /users` | Admin lists users |
| `users` | `POST /users` | Admin creates user |
| `users` | `PATCH /users/{userId}/status` | Admin updates user status |
| `patients` | `GET /patients/me` | Patient views own profile |
| `patients` | `PATCH /patients/me` | Patient updates own profile |
| `patients` | `GET /patients/{patientId}` | Doctor/staff/admin views patient |
| `doctors` | `GET /doctors` | List/search doctors |
| `doctors` | `GET /doctors/{doctorId}` | View doctor profile |
| `doctors` | `PATCH /doctors/me` | Doctor updates own profile |
| `staff` | `GET /staff` | Admin lists staff |

## MVP Rules

- Patient can only update their own profile.
- Doctor can only update their own profile.
- Admin can manage all user statuses.
- Normal users cannot change their own role.
- Soft-deleted or inactive users should not appear in normal lists.

## Keep Out of MVP

- Complex staff permission system
- Profile verification workflow
- Doctor credential approval workflow
- Full audit history of profile changes

---

## 6. Doctor Discovery

## Purpose

Allow patients to find doctors and choose one for appointment booking.

## MVP Features

- List doctors
- Search/filter by specialty
- Show basic doctor profile
- Show whether doctor is active

## Schema Tables

- `doctor_profiles`
- `users`
- `appointments`
- `doctor_unavailability`

## API Resources

| Resource | Endpoint | Purpose |
|---|---|---|
| `doctors` | `GET /doctors?specialty=cardiology` | Search doctors |
| `doctors` | `GET /doctors/{doctorId}` | View doctor details |
| `appointment-slots` | `GET /doctors/{doctorId}/available-slots?date=YYYY-MM-DD` | View available slots |

## MVP Rules

- Only active doctors should appear for booking.
- Availability should exclude existing appointments.
- Availability should exclude doctor unavailable periods.

## Keep Out of MVP

- Popularity ranking
- Ratings
- Advanced doctor search
- Recommendation engine
- Insurance-based filtering

---

## 7. Appointment Booking

## Purpose

Allow patients or staff to book appointments with doctors safely.

## MVP Features

- Book appointment
- View patient appointments
- View doctor appointments
- Cancel appointment
- Mark appointment completed after visit
- Mark no-show manually if needed

## Schema Tables

- `appointments`
- `patient_profiles`
- `doctor_profiles`
- `doctor_unavailability`

## API Resources

| Resource | Endpoint | Purpose |
|---|---|---|
| `appointments` | `POST /appointments` | Book appointment |
| `appointments` | `GET /appointments/{appointmentId}` | View appointment details |
| `appointments` | `GET /patients/me/appointments` | Patient views own appointments |
| `appointments` | `GET /doctors/me/appointments` | Doctor views own appointments |
| `appointments` | `POST /appointments/{appointmentId}/cancel` | Cancel appointment |
| `appointments` | `POST /appointments/{appointmentId}/complete` | Mark completed |
| `doctor-unavailability` | `POST /doctors/me/unavailability` | Doctor blocks time |

## MVP Rules

- Appointment start time must be before end time.
- A doctor cannot have overlapping scheduled appointments.
- A patient cannot book into a doctor's unavailable time.
- Backend must check conflicts when booking.
- Cancelled appointments should store a cancellation reason.
- Only scheduled appointments can normally be cancelled.

## Keep Out of MVP

- Reschedule as a separate complex workflow
- Appointment status history table
- Automated reminders
- Waitlist
- Recurring appointments

---

## 8. Consultation and Visit Report

## Purpose

Allow doctors to record the clinical visit after an appointment and produce a patient-facing visit report.

The visit report is an API/read-model concept. It combines visit details, prescribed medicines, assigned tests, and report links for frontend display.

## MVP Features

- Start visit from appointment
- Add symptoms
- Add diagnosis
- Add visit notes
- Add prescribed medicines inside the visit
- Assign tests from the test catalog
- Complete visit
- Patient can view a visit report

## Schema Tables

- `visits`
- `test_catalog`
- `visit_assigned_tests`
- `appointments`
- `patient_profiles`
- `doctor_profiles`

## API Resources

| Resource | Endpoint | Purpose |
|---|---|---|
| `visits` | `POST /appointments/{appointmentId}/visit/start` | Start visit |
| `visits` | `GET /visits/{visitId}` | View visit |
| `visits` | `PATCH /visits/{visitId}` | Update symptoms, diagnosis, notes, and medicines |
| `visits` | `POST /visits/{visitId}/complete` | Complete visit |
| `visits` | `GET /patients/me/visits` | Patient views own visits |
| `visit-reports` | `GET /visits/{visitId}/report` | Combined patient-facing visit report |
| `visit-assigned-tests` | `POST /visits/{visitId}/assigned-tests` | Doctor assigns tests |
| `visit-assigned-tests` | `GET /patients/me/assigned-tests` | Patient views assigned tests |

## MVP Rules

- One appointment can have only one visit.
- Only assigned doctor can update the visit.
- Completed visits should not be edited in MVP.
- Visit should store start and end time.
- Patient should not see private/internal notes unless allowed.
- Prescribed medicines are stored inside `visits.prescribed_medicines`.
- Assigned tests are stored separately in `visit_assigned_tests`.
- Assigning a test does not create a lab order.
- A lab order is created only when the patient chooses to do assigned tests at the hospital.
- If the patient uploads an external report for an assigned test, that assigned test can be treated as completed.

## Keep Out of MVP

- Separate prescription and prescription item APIs
- Visit flagging workflow
- Clinical note versioning
- Consent-based doctor access
- Advanced EMR templates
- Structured medical coding
- Pharmacy inventory
- Drug interaction checking

---

## 9. Lab Tests

## Purpose

Allow patients to order doctor-assigned tests at the hospital and allow staff to update internal lab progress.

## MVP Features

- Admin manages test catalog
- Doctor assigns one or more tests during the visit
- Patient orders selected assigned tests at the hospital
- Staff updates lab status
- Staff uploads internal lab report
- Patient views assigned tests and reports

## Schema Tables

- `test_catalog`
- `visit_assigned_tests`
- `lab_orders`
- `lab_order_items`
- `lab_reports`

## API Resources

| Resource | Endpoint | Purpose |
|---|---|---|
| `test-catalog` | `GET /test-catalog` | List available tests |
| `test-catalog` | `POST /test-catalog` | Admin creates test |
| `test-catalog` | `PATCH /test-catalog/{testId}` | Admin updates test |
| `lab-orders` | `POST /lab-orders` | Patient orders assigned tests at hospital |
| `lab-orders` | `GET /patients/me/lab-orders` | Patient views own lab orders |
| `lab-orders` | `GET /lab-orders/{labOrderId}` | View lab order |
| `lab-order-items` | `PATCH /lab-order-items/{itemId}/status` | Staff updates test status |
| `lab-reports` | `POST /lab-order-items/{itemId}/report` | Staff uploads report |

## MVP Rules

- Test catalog item must exist before ordering.
- A lab order belongs to one patient.
- A lab order is created from one or more assigned tests selected by the patient.
- A lab order can be linked back to the visit through assigned tests.
- Same test should not be duplicated in the same lab order.
- Staff controls internal test status updates.
- Patient can view only their own lab orders.
- Patient can complete an assigned test externally by uploading a report instead of creating a lab order.

## Keep Out of MVP

- Sample collection details
- Lab machine integration
- Report approval workflow
- Report version history
- External lab integration

---

## 10. Patient Reports and Documents

## Purpose

Allow patients and staff to store medical documents in the patient record.

## MVP Features

- Patient uploads external report
- Staff uploads internal report
- Patient links an external report to an assigned test when applicable
- Patient views own reports
- Doctor views reports for assigned patient
- Attach files or URLs to reports

## Schema Tables

- `patient_reports`
- `report_attachments`
- `lab_reports`

## API Resources

| Resource | Endpoint | Purpose |
|---|---|---|
| `patient-reports` | `POST /patients/me/reports` | Patient uploads external report |
| `patient-reports` | `GET /patients/me/reports` | Patient views own reports |
| `patient-reports` | `GET /patients/{patientId}/reports` | Doctor/staff/admin views reports |
| `patient-reports` | `GET /patient-reports/{reportId}` | View report details |
| `report-attachments` | `POST /patient-reports/{reportId}/attachments` | Add file attachment |

## MVP Rules

- Report must belong to a patient.
- Report source must be `internal` or `external`.
- External reports are uploaded by patients.
- Internal reports are created by staff/lab workflow.
- External reports can be linked to an assigned test.
- Linked external reports can complete the assigned test without creating a hospital lab order.
- Report attachment must have file storage key or URL.

## Keep Out of MVP

- Advanced document tagging
- OCR
- Document sharing links
- Report revision history
- Complex file access policies

---

## 11. Billing and Payments

## Purpose

Track basic invoices and payments for consultations and services.

## MVP Features

- Create invoice for patient
- Add invoice items
- Record full or partial payment
- Track due amount
- Patient views own invoices
- Staff/admin views billing records

## Schema Tables

- `invoices`
- `invoice_items`
- `payments`

## API Resources

| Resource | Endpoint | Purpose |
|---|---|---|
| `invoices` | `POST /invoices` | Staff/admin creates invoice |
| `invoices` | `GET /invoices/{invoiceId}` | View invoice |
| `invoices` | `GET /patients/me/invoices` | Patient views own invoices |
| `invoice-items` | `POST /invoices/{invoiceId}/items` | Add invoice item |
| `payments` | `POST /invoices/{invoiceId}/payments` | Record payment |
| `payments` | `GET /patients/me/payments` | Patient views payment history |

## MVP Rules

- Invoice belongs to one patient.
- Invoice item amount should equal quantity times unit price.
- Payment amount must be greater than zero.
- Paid amount cannot exceed total amount.
- Due amount should equal total amount minus paid amount.
- Invoice status should be `pending`, `partial`, `paid`, or `void`.

## Keep Out of MVP

- Online payment gateway
- Refunds
- Discounts
- Tax calculation
- Insurance claims
- Advanced receipt generation

---

## 12. Admin Basics

## Purpose

Give admin enough control to operate the MVP.

## MVP Features

- Create doctor user
- Create staff user
- Deactivate user
- Manage test catalog
- View patients
- View appointments
- View invoices

## Schema Tables

- `users`
- `doctor_profiles`
- `staff_profiles`
- `patient_profiles`
- `test_catalog`
- `appointments`
- `invoices`

## API Resources

| Resource | Endpoint | Purpose |
|---|---|---|
| `admin-users` | `GET /admin/users` | List users |
| `admin-users` | `POST /admin/users` | Create doctor/staff user |
| `admin-users` | `PATCH /admin/users/{userId}/status` | Activate/deactivate user |
| `admin-patients` | `GET /admin/patients` | View patient list |
| `admin-appointments` | `GET /admin/appointments` | View appointment list |
| `admin-invoices` | `GET /admin/invoices` | View invoice list |

## MVP Rules

- Admin actions should be protected by admin role.
- Deactivating users should not delete historical records.
- Admin should use the same domain rules as normal workflows.

## Keep Out of MVP

- Advanced dashboard
- Granular admin permissions
- System configuration UI
- Audit log explorer
- Analytics reports

---

## 13. MVP API Resource List

This is the short list of API resources worth implementing first.

| Resource | Priority | Why It Exists |
|---|---:|---|
| `auth` | P0 | Login, register, logout, current user |
| `users` | P0 | Admin user management |
| `patients` | P0 | Patient profile and patient lookup |
| `doctors` | P0 | Doctor profile and doctor search |
| `doctor-unavailability` | P1 | Doctor blocked time |
| `appointment-slots` | P1 | Available appointment times |
| `appointments` | P0 | Booking and appointment lifecycle |
| `visits` | P0 | Consultation record |
| `visit-reports` | P0 | Combined visit output for patient UI |
| `visit-assigned-tests` | P0 | Tests assigned by doctor during visit |
| `test-catalog` | P1 | Available lab tests |
| `lab-orders` | P1 | Patient orders assigned tests at hospital |
| `lab-order-items` | P1 | Individual test status |
| `lab-reports` | P2 | Internal lab result upload |
| `patient-reports` | P1 | Patient documents and external reports |
| `report-attachments` | P2 | Files attached to reports |
| `invoices` | P1 | Billing record |
| `invoice-items` | P1 | Bill line items |
| `payments` | P1 | Payment tracking |

Priority meaning:

- `P0`: Required for core MVP flow
- `P1`: Required for complete hospital workflow
- `P2`: Useful but can be built after the core flow works

---

## 14. MVP Build Order

## Phase 1: Foundation

Build:

- Auth
- Users
- Patient profile
- Doctor profile
- Staff profile

Result:

The system can identify users and enforce basic role access.

## Phase 2: Appointment Flow

Build:

- Doctor search
- Available slots
- Doctor unavailability
- Appointment booking
- Appointment cancellation

Result:

Patients can book doctors, and doctors can see appointment queues.

## Phase 3: Consultation Flow

Build:

- Start visit
- Update visit notes, symptoms, diagnosis, and medicines
- Assign tests during visit
- Complete visit
- Visit report view

Result:

Doctors can complete the basic clinical workflow.

## Phase 4: Lab and Reports

Build:

- Test catalog
- Assigned test list
- Lab orders
- Lab order items
- Lab status update
- Patient report upload
- Basic report viewing

Result:

Patients can order assigned tests at the hospital, staff can update tests, and patients can upload or view reports.

## Phase 5: Billing

Build:

- Invoices
- Invoice items
- Payments
- Due tracking

Result:

The system can track consultation/service billing and partial payments.

---

## 15. MVP Non-Functional Requirements

Keep these in the MVP from the beginning:

- Backend validation on every write request
- Role-based access on protected routes
- Data ownership checks for patient data
- Conflict-safe appointment booking
- Pagination on list APIs
- Safe money handling using decimal values
- Timestamps stored with timezone
- Clear error responses

Do not postpone these, because they affect the correctness and safety of the whole system.

---

## 16. Suggested Next Document

The next useful document should be:

`mvp-api-contract.md`

It should define exact request bodies, response bodies, validation rules, and status codes for each MVP resource.
