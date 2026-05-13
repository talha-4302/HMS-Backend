import { getRefreshTokenMaxAgeMs } from './token.js';

export const refreshTokenCookieName = 'hms_refresh_token';

export function setRefreshTokenCookie(res, refreshToken) {
  res.cookie(refreshTokenCookieName, refreshToken, getRefreshTokenCookieOptions());
}

export function clearRefreshTokenCookie(res) {
  res.clearCookie(refreshTokenCookieName, getRefreshTokenClearOptions());
}

export function getRefreshTokenFromRequest(req) {
  return req.cookies?.[refreshTokenCookieName] ?? null;
}

function getRefreshTokenCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: getRefreshTokenMaxAgeMs(),
  };
}

function getRefreshTokenClearOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
  };
}
