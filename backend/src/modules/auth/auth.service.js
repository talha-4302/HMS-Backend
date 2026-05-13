import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { AppError } from '../../shared/errors/AppError.js';
import { errorCodes } from '../../shared/errors/errorCodes.js';
import { comparePassword, hashPassword } from '../../shared/utils/password.js';
import {
  generateRefreshToken,
  getRefreshTokenExpiresAt,
  hashRefreshToken,
  signAccessToken,
} from '../../shared/utils/token.js';
import * as authRepository from './auth.repository.js';

const ACTIVE_USER_STATUS = 'active';
const POSTGRES_UNIQUE_VIOLATION = '23505';

export async function registerPatient(input, requestContext = {}) {
  const email = normalizeEmail(input.email);
  const existingUser = await authRepository.findUserByEmail(pool, email);

  if (existingUser) {
    throwEmailAlreadyExists();
  }

  const passwordHash = await hashPassword(input.password);
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const refreshTokenExpiresAt = getRefreshTokenExpiresAt();

  try {
    const { user, patientProfile } = await withTransaction(async (db) => {
      const createdUser = await authRepository.createPatientUser(db, {
        email,
        passwordHash,
      });

      const createdPatientProfile = await authRepository.createPatientProfile(db, {
        userId: createdUser.id,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
      });

      await authRepository.createRefreshSession(db, {
        userId: createdUser.id,
        refreshTokenHash,
        expiresAt: refreshTokenExpiresAt,
        ...requestContext,
      });

      return {
        user: createdUser,
        patientProfile: createdPatientProfile,
      };
    });

    return {
      user: toPublicUser(user),
      patientProfile,
      accessToken: signAccessToken(user),
      refreshToken,
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throwEmailAlreadyExists();
    }

    throw error;
  }
}

export async function login(input, requestContext = {}) {
  const email = normalizeEmail(input.email);
  const user = await authRepository.findUserByEmail(pool, email);

  if (!user) {
    throwInvalidCredentials();
  }

  const passwordMatches = await comparePassword(input.password, user.passwordHash);

  if (!passwordMatches) {
    throwInvalidCredentials();
  }

  assertUserCanAuthenticate(user);

  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const refreshTokenExpiresAt = getRefreshTokenExpiresAt();

  const updatedUser = await withTransaction(async (db) => {
    const loggedInUser = await authRepository.updateLastLoginAt(db, user.id);

    await authRepository.createRefreshSession(db, {
      userId: user.id,
      refreshTokenHash,
      expiresAt: refreshTokenExpiresAt,
      ...requestContext,
    });

    return loggedInUser;
  });

  return {
    user: toPublicUser(updatedUser),
    accessToken: signAccessToken(updatedUser),
    refreshToken,
  };
}

export async function refreshSession(refreshToken, requestContext = {}) {
  if (!refreshToken) {
    throwInvalidRefreshToken();
  }

  const currentRefreshTokenHash = hashRefreshToken(refreshToken);
  const nextRefreshToken = generateRefreshToken();
  const nextRefreshTokenHash = hashRefreshToken(nextRefreshToken);
  const nextRefreshTokenExpiresAt = getRefreshTokenExpiresAt();

  const user = await withTransaction(async (db) => {
    const refreshSession = await authRepository.findRefreshSessionByHash(
      db,
      currentRefreshTokenHash,
    );

    validateRefreshSession(refreshSession);
    assertUserCanAuthenticate(refreshSession.user);

    await authRepository.markRefreshSessionUsed(db, refreshSession.id);
    await authRepository.revokeRefreshSession(db, refreshSession.id);
    await authRepository.createRefreshSession(db, {
      userId: refreshSession.user.id,
      refreshTokenHash: nextRefreshTokenHash,
      expiresAt: nextRefreshTokenExpiresAt,
      ...requestContext,
    });

    return refreshSession.user;
  });

  return {
    user: toPublicUser(user),
    accessToken: signAccessToken(user),
    refreshToken: nextRefreshToken,
  };
}

export async function logout(refreshToken) {
  if (!refreshToken) {
    return;
  }

  const refreshTokenHash = hashRefreshToken(refreshToken);

  await authRepository.revokeRefreshSessionByHash(pool, refreshTokenHash);
}

export async function getCurrentUser(userId) {
  const user = await authRepository.findUserById(pool, userId);

  if (!user) {
    throwUnauthorized('Authenticated user no longer exists');
  }

  assertUserCanAuthenticate(user);

  const profile = await authRepository.findProfileSummaryByUser(pool, user);

  if (user.role !== 'admin' && !profile) {
    throw new AppError({
      statusCode: 404,
      code: errorCodes.PROFILE_NOT_FOUND,
      message: 'Profile not found',
    });
  }

  return {
    user: toPublicUser(user),
    profile,
  };
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function validateRefreshSession(refreshSession) {
  if (!refreshSession || refreshSession.revoked) {
    throwInvalidRefreshToken();
  }

  if (new Date(refreshSession.expiresAt).getTime() <= Date.now()) {
    throwInvalidRefreshToken();
  }
}

function assertUserCanAuthenticate(user) {
  if (user.status !== ACTIVE_USER_STATUS) {
    throw new AppError({
      statusCode: 403,
      code: errorCodes.USER_NOT_ACTIVE,
      message: 'User account is not active',
    });
  }
}

function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
  };
}

function throwEmailAlreadyExists() {
  throw new AppError({
    statusCode: 409,
    code: errorCodes.EMAIL_ALREADY_EXISTS,
    message: 'Email is already registered',
  });
}

function throwInvalidCredentials() {
  throw new AppError({
    statusCode: 401,
    code: errorCodes.INVALID_CREDENTIALS,
    message: 'Email or password is incorrect',
  });
}

function throwInvalidRefreshToken() {
  throw new AppError({
    statusCode: 401,
    code: errorCodes.INVALID_REFRESH_TOKEN,
    message: 'Refresh token is invalid or expired',
  });
}

function throwUnauthorized(message) {
  throw new AppError({
    statusCode: 401,
    code: errorCodes.UNAUTHORIZED,
    message,
  });
}

function isUniqueViolation(error) {
  return error?.code === POSTGRES_UNIQUE_VIOLATION;
}
