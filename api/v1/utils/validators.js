import { body } from 'express-validator';

// define validators
export const email_validator = body('email')
    .isEmail().withMessage('Please enter a valid email address.')
    .normalizeEmail()

export function get_password_validator(fieldName){
      return body(`${fieldName}`)
      .isLength({ min: 8, max: 12 }).withMessage(`${fieldName} must be at least between 8 and 12 characters long.`)
      .matches(/\d/).withMessage(`${fieldName} must contain at least one number.`)
      // .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage(`${fieldName} must contain at least one special character.`), // Must contain a special character
}

export const firstname_validator = body('firstname')
      .trim()
      .notEmpty().withMessage('First name is required.')
      .isString().withMessage('First name must be a string.')
    //   .isLength({ min: 3, max: 20 }).withMessage('First name must be between 3 and 20 characters.')

export const lastname_validator = body('lastname')
      .trim()
      .notEmpty().withMessage('Last name is required.')
      .isString().withMessage('Last name must be a string.')
    //   .isLength({ min: 3, max: 20 }).withMessage('Last name must be between 3 and 20 characters.')

// Define the E.164 regex
const e164Regex = /^\+[1-9]\d{1,14}$/;
export const phone_validator = body('phone')
        .trim()
        .notEmpty().withMessage('Phone number is required.')
        // Custom validation using the E.164 regex
        .matches(e164Regex).withMessage('Invalid phone number format. Must be in E.164 format (e.g., +12025550123).')

export const userId_validator = body('userId').notEmpty().withMessage('User ID is required.')

export function get_otp_validator(fieldName){
      return body(fieldName).notEmpty().withMessage(`${fieldName} is required.`).isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits long.')
}


const ALLOWED_CONTACT_METHODS = ['sms', 'email', 'app'];
export const guardian_contact_method_validator = body('contact_method')
  .isArray({ min: 1 }).withMessage('Guardian contact method must be an array with at least one element.')
  .custom((value, { req, location, path }) => {
    // 'value' here is the array itself (e.g., ['sms', 'email'])
    if (!Array.isArray(value)) {
      throw new Error('Guardian contact method must be an array.');
    }

    for (const method of value) {
      // Ensure each method is a string
      if (typeof method !== 'string') {
        throw new Error(`Each contact method in the array must be a string.`);
      }
      // Ensure each method is one of the allowed values
      if (!ALLOWED_CONTACT_METHODS.includes(method)) {
        throw new Error(`Invalid contact method: "${method}". Allowed methods are ${ALLOWED_CONTACT_METHODS.join(', ')}.`);
      }
    }
    return true; // If all checks pass, return true
  });

export function getOptionalBooleanValidator(fieldName){
    return body(`${fieldName}`)
        .optional({ checkFalsy: true })
        .toBoolean()
        .isBoolean()
        .withMessage(`${fieldName} field must be a boolean (true or false).`)
}

export function getBooleanValidatorWithFalseDefault(fieldName){
    return body(`${fieldName}`)
      .customSanitizer(value => {
            if (typeof value === 'undefined') {
                  return false;
            }
            // Otherwise, return the value as is for further processing
            return value;
      })
      .toBoolean()
      .isBoolean()
      .withMessage(`${fieldName} field must be a boolean (true or false).`);
}