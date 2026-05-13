import { AppError } from '../errors/AppError.js';
import { errorCodes } from '../errors/errorCodes.js';
import { verifyAccessToken } from '../utils/token.js';

export function authenticate(req, res, next) {
  const accessToken = getBearerToken(req.headers.authorization);

  if (!accessToken) {
    return next(
      new AppError({
        statusCode: 401,
        code: errorCodes.UNAUTHORIZED,
        message: 'Authentication required',
      }),
    );
  }

  try {
    req.user = verifyAccessToken(accessToken);
    return next();
  } catch {
    return next(
      new AppError({
        statusCode: 401,
        code: errorCodes.UNAUTHORIZED,
        message: 'Invalid or expired access token',
      }),
    );
  }
}

function getBearerToken(authorizationHeader) {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}
