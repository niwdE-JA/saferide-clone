import { body } from 'express-validator';

// define validators
export const email_validator = body('email')
    .isEmail().withMessage('Please enter a valid email address.')
    .normalizeEmail()

export const password_validator = body('password')
    .isLength({ min: 8, max: 12 }).withMessage('Password must be at least between 8 and 12 characters long.')
    .matches(/\d/).withMessage('Password must contain at least one number.')
    // .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character.'), // Must contain a special character

export const firstname_validator = body('firstname')
      .trim()
      .notEmpty().withMessage('First name is required.')
    //   .isLength({ min: 3, max: 20 }).withMessage('First name must be between 3 and 20 characters.')

export const lastname_validator = body('lastname')
      .trim()
      .notEmpty().withMessage('Last name is required.')
    //   .isLength({ min: 3, max: 20 }).withMessage('Last name must be between 3 and 20 characters.')
