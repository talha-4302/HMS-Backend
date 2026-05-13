export async function findUserByEmail(db, email) {
  const result = await db.query(
    `
    SELECT id, email, password_hash, role, status, last_login_at, created_at, updated_at
    FROM users
    WHERE email = $1
      AND deleted_at IS NULL
    LIMIT 1
    `,
    [email],
  );

  return mapUser(result.rows[0]);
}

export async function findUserById(db, userId) {
  const result = await db.query(
    `
    SELECT id, email, password_hash, role, status, last_login_at, created_at, updated_at
    FROM users
    WHERE id = $1
      AND deleted_at IS NULL
    LIMIT 1
    `,
    [userId],
  );

  return mapUser(result.rows[0]);
}

export async function createPatientUser(db, { email, passwordHash }) {
  const result = await db.query(
    `
    INSERT INTO users (email, password_hash, role)
    VALUES ($1, $2, 'patient')
    RETURNING id, email, password_hash, role, status, last_login_at, created_at, updated_at
    `,
    [email, passwordHash],
  );

  return mapUser(result.rows[0]);
}

export async function createPatientProfile(db, { userId, firstName, lastName, phone }) {
  const result = await db.query(
    `
    INSERT INTO patient_profiles (user_id, first_name, last_name, phone)
    VALUES ($1, $2, $3, $4)
    RETURNING id, user_id, first_name, last_name, phone, created_at, updated_at
    `,
    [userId, firstName, lastName, phone ?? null],
  );

  return mapPatientProfile(result.rows[0]);
}

export async function updateLastLoginAt(db, userId) {
  const result = await db.query(
    `
    UPDATE users
    SET last_login_at = now(),
        updated_at = now()
    WHERE id = $1
    RETURNING id, email, password_hash, role, status, last_login_at, created_at, updated_at
    `,
    [userId],
  );

  return mapUser(result.rows[0]);
}

export async function createRefreshSession(
  db,
  { userId, refreshTokenHash, expiresAt, deviceInfo, browser, os, ipAddress },
) {
  const result = await db.query(
    `
    INSERT INTO refresh_sessions (
      user_id,
      refresh_token_hash,
      device_info,
      browser,
      os,
      ip_address,
      expires_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, user_id, expires_at, last_used_at, revoked, created_at
    `,
    [
      userId,
      refreshTokenHash,
      deviceInfo ?? null,
      browser ?? null,
      os ?? null,
      ipAddress ?? null,
      expiresAt,
    ],
  );

  return mapRefreshSession(result.rows[0]);
}

export async function findRefreshSessionByHash(db, refreshTokenHash) {
  const result = await db.query(
    `
    SELECT
      refresh_sessions.id,
      refresh_sessions.user_id,
      refresh_sessions.expires_at,
      refresh_sessions.last_used_at,
      refresh_sessions.revoked,
      refresh_sessions.created_at,
      users.email,
      users.password_hash,
      users.role,
      users.status,
      users.last_login_at,
      users.created_at AS user_created_at,
      users.updated_at AS user_updated_at
    FROM refresh_sessions
    JOIN users ON users.id = refresh_sessions.user_id
    WHERE refresh_sessions.refresh_token_hash = $1
      AND users.deleted_at IS NULL
    LIMIT 1
    `,
    [refreshTokenHash],
  );

  return mapRefreshSessionWithUser(result.rows[0]);
}

export async function markRefreshSessionUsed(db, refreshSessionId) {
  const result = await db.query(
    `
    UPDATE refresh_sessions
    SET last_used_at = now()
    WHERE id = $1
    RETURNING id, user_id, expires_at, last_used_at, revoked, created_at
    `,
    [refreshSessionId],
  );

  return mapRefreshSession(result.rows[0]);
}

export async function revokeRefreshSession(db, refreshSessionId) {
  const result = await db.query(
    `
    UPDATE refresh_sessions
    SET revoked = TRUE
    WHERE id = $1
    RETURNING id, user_id, expires_at, last_used_at, revoked, created_at
    `,
    [refreshSessionId],
  );

  return mapRefreshSession(result.rows[0]);
}

export async function revokeRefreshSessionByHash(db, refreshTokenHash) {
  const result = await db.query(
    `
    UPDATE refresh_sessions
    SET revoked = TRUE
    WHERE refresh_token_hash = $1
    RETURNING id, user_id, expires_at, last_used_at, revoked, created_at
    `,
    [refreshTokenHash],
  );

  return mapRefreshSession(result.rows[0]);
}

export async function findProfileSummaryByUser(db, user) {
  if (user.role === 'patient') {
    return findPatientProfileSummaryByUserId(db, user.id);
  }

  if (user.role === 'doctor') {
    return findDoctorProfileSummaryByUserId(db, user.id);
  }

  if (user.role === 'staff') {
    return findStaffProfileSummaryByUserId(db, user.id);
  }

  return null;
}

async function findPatientProfileSummaryByUserId(db, userId) {
  const result = await db.query(
    `
    SELECT id, first_name, last_name
    FROM patient_profiles
    WHERE user_id = $1
      AND deleted_at IS NULL
    LIMIT 1
    `,
    [userId],
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    type: 'patient',
    firstName: row.first_name,
    lastName: row.last_name,
  };
}

async function findDoctorProfileSummaryByUserId(db, userId) {
  const result = await db.query(
    `
    SELECT id, specialty
    FROM doctor_profiles
    WHERE user_id = $1
      AND deleted_at IS NULL
    LIMIT 1
    `,
    [userId],
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    type: 'doctor',
    specialty: row.specialty,
  };
}

async function findStaffProfileSummaryByUserId(db, userId) {
  const result = await db.query(
    `
    SELECT id, department, title
    FROM staff_profiles
    WHERE user_id = $1
      AND deleted_at IS NULL
    LIMIT 1
    `,
    [userId],
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    type: 'staff',
    department: row.department,
    title: row.title,
  };
}

function mapUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    status: row.status,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPatientProfile(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRefreshSession(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    expiresAt: row.expires_at,
    lastUsedAt: row.last_used_at,
    revoked: row.revoked,
    createdAt: row.created_at,
  };
}

function mapRefreshSessionWithUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    expiresAt: row.expires_at,
    lastUsedAt: row.last_used_at,
    revoked: row.revoked,
    createdAt: row.created_at,
    user: mapUser({
      id: row.user_id,
      email: row.email,
      password_hash: row.password_hash,
      role: row.role,
      status: row.status,
      last_login_at: row.last_login_at,
      created_at: row.user_created_at,
      updated_at: row.user_updated_at,
    }),
  };
}
