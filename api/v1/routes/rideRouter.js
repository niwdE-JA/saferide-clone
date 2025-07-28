import { Router } from 'express';
import { validationResult } from 'express-validator';
import { getOptionalBooleanValidator, guardian_contact_method_validator, getBooleanValidatorWithFalseDefault, firstname_validator, lastname_validator, phone_validator, email_validator } from '../utils/validators.js';

import 'dotenv/config';
import { authenticateToken } from './authRouter.js';
import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';


const rideRouter = Router();
// const JWT_SECRET = process.env.JWT_SECRET;



export default rideRouter;
