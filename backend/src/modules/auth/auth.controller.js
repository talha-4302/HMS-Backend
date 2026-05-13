import {
  clearRefreshTokenCookie,
  getRefreshTokenFromRequest,
  setRefreshTokenCookie,
} from '../../shared/utils/authCookie.js';
import * as authService from './auth.service.js';

export async function register(req, res) {
  const result = await authService.registerPatient(req.body, getRequestContext(req));

  setRefreshTokenCookie(res, result.refreshToken);

  return res.status(201).json({
    success: true,
    data: {
      user: result.user,
      patientProfile: result.patientProfile,
      accessToken: result.accessToken,
    },
    message: 'Registration successful',
  });
}

export async function login(req, res) {
  const result = await authService.login(req.body, getRequestContext(req));

  setRefreshTokenCookie(res, result.refreshToken);

  return res.status(200).json({
    success: true,
    data: {
      user: result.user,
      accessToken: result.accessToken,
    },
  });
}

export async function refresh(req, res) {
  const refreshToken = getRefreshTokenFromRequest(req);
  const result = await authService.refreshSession(refreshToken, getRequestContext(req));

  setRefreshTokenCookie(res, result.refreshToken);

  return res.status(200).json({
    success: true,
    data: {
      accessToken: result.accessToken,
    },
  });
}

export async function logout(req, res) {
  const refreshToken = getRefreshTokenFromRequest(req);

  await authService.logout(refreshToken);
  clearRefreshTokenCookie(res);

  return res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
}

export async function me(req, res) {
  const result = await authService.getCurrentUser(req.user.id);

  return res.status(200).json({
    success: true,
    data: result,
  });
}

function getRequestContext(req) {
  const userAgent = req.get('user-agent') ?? null;

  return {
    deviceInfo: userAgent,
    ipAddress: req.ip,
  };
}
