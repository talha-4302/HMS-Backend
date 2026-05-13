import crypto from 'node:crypto';

import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config({ quiet: true });

const REFRESH_TOKEN_BYTE_LENGTH = 64;

export function signAccessToken(user) {
  return jwt.sign(
    {
      email: user.email,
      role: user.role,
    },
    getRequiredEnv('JWT_ACCESS_SECRET'),
    {
      expiresIn: getRequiredEnv('JWT_ACCESS_EXPIRES_IN'),
      subject: user.id,
    },
  );
}

export function verifyAccessToken(accessToken) {
  const decoded = jwt.verify(accessToken, getRequiredEnv('JWT_ACCESS_SECRET'));

  if (!decoded || typeof decoded !== 'object' || !decoded.sub) {
    throw new Error('Access token payload is invalid');
  }

  return {
    id: decoded.sub,
    email: decoded.email,
    role: decoded.role,
  };
}

export function generateRefreshToken() {
  return crypto.randomBytes(REFRESH_TOKEN_BYTE_LENGTH).toString('base64url');
}

export function hashRefreshToken(refreshToken) {
  return crypto
    .createHmac('sha256', getRequiredEnv('JWT_REFRESH_SECRET'))
    .update(refreshToken)
    .digest('hex');
}

export function getRefreshTokenExpiresAt() {
  return new Date(Date.now() + getRefreshTokenMaxAgeMs());
}

export function getRefreshTokenMaxAgeMs() {
  return parseDurationToMs(getRequiredEnv('JWT_REFRESH_EXPIRES_IN'));
}

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function parseDurationToMs(duration) {
  const match = /^(\d+)(ms|s|m|h|d)$/u.exec(duration);

  if (!match) {
    throw new Error('JWT_REFRESH_EXPIRES_IN must use a duration like 7d, 24h, 60m, or 3600s');
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * multipliers[unit];
}
