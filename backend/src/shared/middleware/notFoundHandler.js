import { AppError } from '../errors/AppError.js';
import { errorCodes } from '../errors/errorCodes.js';

export function notFoundHandler(req, res, next) {
  return next(
    new AppError({
      statusCode: 404,
      code: errorCodes.NOT_FOUND,
      message: 'Route not found',
    }),
  );
}
