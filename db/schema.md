# Healthcare Management System - MVP PostgreSQL Schema

```sql
-- =========================================================
-- 0) Extensions
-- =========================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- =========================================================
-- 1) Enums
-- =========================================================
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'flagged', 'soft_deleted');
CREATE TYPE user_role AS ENUM ('patient', 'doctor', 'staff', 'admin');
CREATE TYPE appointment_status AS ENUM ('scheduled', 'completed', 'cancelled', 'no_show');
CREATE TYPE visit_status AS ENUM ('in_progress', 'ready_for_closure', 'completed', 'flagged');
CREATE TYPE lab_status AS ENUM ('requested', 'sample_collected', 'processing', 'completed', 'cancelled');
CREATE TYPE assigned_test_status AS ENUM ('assigned', 'ordered_internal', 'completed', 'cancelled');
CREATE TYPE report_source AS ENUM ('internal', 'external');
CREATE TYPE invoice_status AS ENUM ('pending', 'partial', 'paid', 'void');
CREATE TYPE payment_method AS ENUM ('cash', 'online', 'other');
CREATE TYPE invoice_item_type AS ENUM ('consultation', 'test', 'service', 'other');
CREATE TYPE gender_type AS ENUM ('male', 'female', 'third_gender');
CREATE TYPE blood_group_type AS ENUM ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');

-- =========================================================
-- 2) RBAC + Identity
-- =========================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL,
  status user_status NOT NULL DEFAULT 'active',
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE refresh_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  device_info TEXT,
  browser TEXT,
  os TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ,
  revoked BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================
-- 3) Profiles
-- =========================================================
CREATE TABLE patient_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  dob DATE,
  gender gender_type,
  phone TEXT,
  address TEXT,
  blood_group blood_group_type,
  allergies TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE doctor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  specialty TEXT,
  credentials JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Optional MVP table; create only if extra staff fields are needed.
CREATE TABLE staff_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  department TEXT,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- =========================================================
-- 4) Scheduling
-- =========================================================


CREATE TABLE doctor_unavailability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctor_profiles(id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  date DATE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (start_at < end_at)
);

CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patient_profiles(id),
  doctor_id UUID NOT NULL REFERENCES doctor_profiles(id),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status appointment_status NOT NULL DEFAULT 'scheduled',
  booked_by_user_id UUID REFERENCES users(id),
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (start_at < end_at)
);


-- =========================================================
-- 5) Consultation / EMR
-- =========================================================
CREATE TABLE visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID UNIQUE REFERENCES appointments(id),
  patient_id UUID NOT NULL REFERENCES patient_profiles(id),
  doctor_id UUID NOT NULL REFERENCES doctor_profiles(id),
  status visit_status NOT NULL DEFAULT 'in_progress',
  visit_notes TEXT,
  symptoms JSONB,
  diagnoses JSONB,
  prescribed_medicines JSONB NOT NULL DEFAULT '[]'::jsonb,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================
-- 6) Tests & Lab
-- =========================================================
CREATE TABLE test_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  test_category TEXT NOT NULL,
  default_price NUMERIC(12,2) NOT NULL CHECK (default_price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE visit_assigned_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  test_catalog_id UUID NOT NULL REFERENCES test_catalog(id),
  status assigned_test_status NOT NULL DEFAULT 'assigned',
  assigned_by_user_id UUID REFERENCES users(id),
  instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (visit_id, test_catalog_id)
);

CREATE TABLE lab_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patient_profiles(id),
  doctor_id UUID REFERENCES doctor_profiles(id),
  visit_id UUID REFERENCES visits(id),
  status lab_status NOT NULL DEFAULT 'requested',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE lab_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_order_id UUID NOT NULL REFERENCES lab_orders(id) ON DELETE CASCADE,
  assigned_test_id UUID UNIQUE REFERENCES visit_assigned_tests(id),
  test_catalog_id UUID NOT NULL REFERENCES test_catalog(id),
  status lab_status NOT NULL DEFAULT 'requested',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lab_order_id, test_catalog_id)
);

CREATE TABLE lab_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_order_id UUID REFERENCES lab_orders(id) ON DELETE CASCADE,
  lab_order_item_id UUID REFERENCES lab_order_items(id) ON DELETE CASCADE,
  report_title TEXT NOT NULL,
  report_data JSONB,
  storage_key TEXT,
  url TEXT,
  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (lab_order_id IS NOT NULL OR lab_order_item_id IS NOT NULL)
);

-- =========================================================
-- 7) Reports / Documents
-- =========================================================
CREATE TABLE patient_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
  source report_source NOT NULL,
  linked_visit_id UUID REFERENCES visits(id),
  linked_lab_order_id UUID REFERENCES lab_orders(id),
  linked_assigned_test_id UUID REFERENCES visit_assigned_tests(id),
  title TEXT NOT NULL,
  report_date DATE,
  uploaded_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE report_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES patient_reports(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  storage_key TEXT,
  url TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (storage_key IS NOT NULL OR url IS NOT NULL)
);

-- =========================================================
-- 8) Billing & Payments
-- =========================================================
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patient_profiles(id),
  visit_id UUID REFERENCES visits(id),
  status invoice_status NOT NULL DEFAULT 'pending',
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  due_amount NUMERIC(12,2) NOT NULL CHECK (due_amount >= 0),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (paid_amount <= total_amount)
  -- Application must enforce due_amount = total_amount - paid_amount in MVP.
);



CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  item_type invoice_item_type NOT NULL,
  reference_id UUID,
  description TEXT NOT NULL,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (amount = quantity * unit_price)
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method payment_method NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Deferred for MVP:
-- CREATE TABLE payment_transactions (...);

-- =========================================================
-- 9) Discovery Metrics (MVP: computed, not materialized)
-- =========================================================
-- Use query-time computation from completed appointments/utilization.
-- Deferred for later:
-- CREATE TABLE doctor_popularity_metrics (...);

-- =========================================================
-- 10) Indexes
-- =========================================================
CREATE INDEX idx_refresh_sessions_user_id ON refresh_sessions(user_id);
CREATE INDEX idx_audit_logs_actor_user_id ON audit_logs(actor_user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

CREATE INDEX idx_patient_profiles_user_id ON patient_profiles(user_id);
CREATE INDEX idx_doctor_profiles_user_id ON doctor_profiles(user_id);
CREATE INDEX idx_staff_profiles_user_id ON staff_profiles(user_id);

CREATE INDEX idx_doctor_unavailability_doctor_id_start_end ON doctor_unavailability(doctor_id, start_at, end_at);
CREATE INDEX idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX idx_appointments_doctor_id_start_at ON appointments(doctor_id, start_at);
CREATE INDEX idx_appointments_status ON appointments(status);


CREATE INDEX idx_visits_appointment_id ON visits(appointment_id);
CREATE INDEX idx_visits_patient_id ON visits(patient_id);
CREATE INDEX idx_visits_doctor_id ON visits(doctor_id);
CREATE INDEX idx_visits_status ON visits(status);

CREATE INDEX idx_visit_assigned_tests_visit_id ON visit_assigned_tests(visit_id);
CREATE INDEX idx_visit_assigned_tests_test_catalog_id ON visit_assigned_tests(test_catalog_id);
CREATE INDEX idx_visit_assigned_tests_status ON visit_assigned_tests(status);

CREATE INDEX idx_lab_orders_patient_id ON lab_orders(patient_id);
CREATE INDEX idx_lab_orders_doctor_id ON lab_orders(doctor_id);
CREATE INDEX idx_lab_orders_visit_id ON lab_orders(visit_id);
CREATE INDEX idx_lab_orders_status ON lab_orders(status);
CREATE INDEX idx_lab_order_items_lab_order_id ON lab_order_items(lab_order_id);
CREATE INDEX idx_lab_order_items_assigned_test_id ON lab_order_items(assigned_test_id);
CREATE INDEX idx_lab_order_items_test_catalog_id ON lab_order_items(test_catalog_id);

CREATE INDEX idx_lab_reports_lab_order_id ON lab_reports(lab_order_id);
CREATE INDEX idx_lab_reports_lab_order_item_id ON lab_reports(lab_order_item_id);

CREATE INDEX idx_patient_reports_patient_id ON patient_reports(patient_id);
CREATE INDEX idx_patient_reports_source ON patient_reports(source);
CREATE INDEX idx_patient_reports_linked_visit_id ON patient_reports(linked_visit_id);
CREATE INDEX idx_patient_reports_linked_lab_order_id ON patient_reports(linked_lab_order_id);
CREATE INDEX idx_patient_reports_linked_assigned_test_id ON patient_reports(linked_assigned_test_id);
CREATE INDEX idx_report_attachments_report_id ON report_attachments(report_id);

CREATE INDEX idx_invoices_patient_id ON invoices(patient_id);
CREATE INDEX idx_invoices_visit_id ON invoices(visit_id);
CREATE INDEX idx_invoices_status ON invoices(status);

CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX idx_payments_paid_at ON payments(paid_at DESC);
```

