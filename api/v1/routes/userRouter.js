import { Router } from 'express';
import { validationResult } from 'express-validator';
import { email_validator, password_validator, firstname_validator, lastname_validator } from '../utils/validators.js';

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { FieldValue } from 'firebase-admin/firestore';
import 'dotenv/config';

const userRouter = Router();
const JWT_SECRET = process.env.JWT_SECRET;



export default userRouter;
