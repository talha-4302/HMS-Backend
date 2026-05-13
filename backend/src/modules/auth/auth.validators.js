import { body } from 'express-validator';

export const registerValidators = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Valid email is required')
    .bail()
    .normalizeEmail(),
  body('password')
    .isString()
    .withMessage('Password is required')
    .bail()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .bail()
    .matches(/[A-Za-z]/u)
    .withMessage('Password must contain at least one letter')
    .bail()
    .matches(/\d/u)
    .withMessage('Password must contain at least one number'),
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('phone')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 30 })
    .withMessage('Phone must be at most 30 characters long'),
  body('role').not().exists().withMessage('Role cannot be provided during registration'),
];

export const loginValidators = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Valid email is required')
    .bail()
    .normalizeEmail(),
  body('password').isString().notEmpty().withMessage('Password is required'),
];
