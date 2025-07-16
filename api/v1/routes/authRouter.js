import { Router } from 'express';
import { validationResult } from 'express-validator';
import { email_validator, password_validator, firstname_validator, lastname_validator } from '../utils/validators.js';

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { FieldValue } from 'firebase-admin/firestore';
import 'dotenv/config';

const authRouter = Router();
const JWT_SECRET = process.env.JWT_SECRET;


authRouter.post(
  '/signup',
  [ email_validator, password_validator, firstname_validator, lastname_validator ],
  async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, firstname, lastname } = req.body;

    try {
      const db = req.firestoreDatabase;
      
      const usersRef = db.collection('users');

      const emailSnapshot = await usersRef.where('email', '==', email).get();

      if (!emailSnapshot.empty) { // Check if user already exists (by email)
        return res.status(409).json({ message: 'User with this email already exists.' });
      }

      // Hash the password
      const saltRounds = parseInt(process.env.BCRYRPT_SALT_ROUNDS)
      const salt = await bcrypt.genSalt(saltRounds);
      const hashedPassword = await bcrypt.hash(password, salt); // Hash the password with the salt

      // Store the new user in Firestore
      const newUserRef = await usersRef.add({
        firstname: firstname,
        lastname: lastname,
        email: email,
        password: hashedPassword,
        createdAt: FieldValue.serverTimestamp() // Timestamp for creation
      });

      // Get the ID of the newly created user document
      const userId = newUserRef.id;

      // Generate a JWT
      const token = jwt.sign(
        { userId: userId, email: email },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Send success response with the JWT
      res.status(201).json({
        message: 'User signed up successfully!',
        userId: userId,
        token: token,
        user: {
          username: username,
          email: email
        }
      });

    } catch (error) {
      console.error('Error during signup:', error);
      res.status(500).json({ message: 'Server error during signup.', error: error.message });
    }
  }
);


authRouter.post(
  '/login',
  [ email_validator, password_validator ],
  async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      const db = req.firestoreDatabase;

      // Find user by email in Firestore
      const usersRef = db.collection('users');
      const userSnapshot = await usersRef.where('email', '==', email).limit(1).get();

      if (userSnapshot.empty) {
        // User not found
        return res.status(404).json({ message: 'No user found with given credentials.' });
      }

      // Get user data and document ID
      const userData = userSnapshot.docs[0].data();
      const userId = userSnapshot.docs[0].id;
      const hashedPassword = userData.password;

      // Compare provided password with hashed password
      const isMatch = await bcrypt.compare(password, hashedPassword);

      if (!isMatch) {
        // Passwords do not match
        return res.status(401).json({ message: 'Invalid login credentials.' });
      }

      // Generate a JWT for the authenticated user
      const token = jwt.sign(
        { userId: userId, email: email },
        JWT_SECRET,
        { expiresIn: '1h' } // Token expires in 1 hour
      );

      // Send success response with the JWT
      res.status(200).json({
        message: 'Logged in successfully!',
        token: token,
        user: {
          userId,
          firstname: userData.firstname,
          lastname: userData.lastname,
          email: userData.email
        }
      });

    } catch (error) {
      console.error('Error during login:', error);
      res.status(500).json({ message: 'Server error during login.', error: error.message });
    }
  }
);


// --- Authentication Middleware ---
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  // Token format: Bearer <TOKEN>
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    return res.status(401).json({ message: 'Authentication token required.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.error('JWT verification failed:', err.message);
      return res.status(403).json({ message: 'Invalid or expired token.' });
    }
    
    req.user = user; // Attach user payload to request
    next(); // Proceed to the next middleware/route handler
  });
};


export default authRouter;