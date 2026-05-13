import { validationResult } from 'express-validator';

import { AppError } from '../errors/AppError.js';
import { errorCodes } from '../errors/errorCodes.js';

export function validateRequest(req, res, next) {
  const validation = validationResult(req);

  if (validation.isEmpty()) {
    return next();
  }

  const details = validation.array().map((error) => ({
    field: error.path,
    message: error.msg,
  }));

  return next(
    new AppError({
      statusCode: 422,
      code: errorCodes.VALIDATION_ERROR,
      message: 'Validation failed',
      details,
    }),
  );
}
