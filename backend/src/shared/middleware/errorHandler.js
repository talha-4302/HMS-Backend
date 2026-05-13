import { errorCodes } from '../errors/errorCodes.js';

export function errorHandler(error, req, res, next) {
  const statusCode = getStatusCode(error);
  const responseError = {
    code: getErrorCode(error),
    message: getErrorMessage(error, statusCode),
  };

  if (error?.details !== undefined) {
    responseError.details = error.details;
  }

  if (!isOperationalError(error)) {
    console.error(error);
  }

  return res.status(statusCode).json({
    success: false,
    error: responseError,
  });
}

function getStatusCode(error) {
  const statusCode = Number(error?.statusCode);

  if (Number.isInteger(statusCode) && statusCode >= 400 && statusCode <= 599) {
    return statusCode;
  }

  return 500;
}

function getErrorCode(error) {
  if (typeof error?.code === 'string' && error.code.length > 0) {
    return error.code;
  }

  return errorCodes.INTERNAL_SERVER_ERROR;
}

function getErrorMessage(error, statusCode) {
  if (isOperationalError(error) && error.message) {
    return error.message;
  }

  if (statusCode === 404) {
    return 'Route not found';
  }

  return 'Internal server error';
}

function isOperationalError(error) {
  return Boolean(error?.isOperational);
}
