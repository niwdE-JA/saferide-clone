import { Router } from 'express';
import { validationResult } from 'express-validator';
import { email_validator, password_validator, firstname_validator, lastname_validator } from '../utils/validators.js';

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { FieldValue } from 'firebase-admin/firestore';
import 'dotenv/config';
import { authenticateToken } from './authRouter.js';

const userRouter = Router();
const JWT_SECRET = process.env.JWT_SECRET;

// Define the E.164 regex
const e164Regex = /^\+[1-9]\d{1,14}$/;

// --- Protected Route: Update Emergency Contacts ---
userRouter.put(
  '/:userId/contacts',
  authenticateToken, // Protect this route with JWT authentication
  [
    // Validate that the userId in the URL matches the authenticated user's ID
    param('userId').custom((value, { req }) => {
      if (value !== req.user.userId) {
        throw new Error('Unauthorized: You can only update your own emergency contacts.');
      }
      return true;
    }),

    // Validate 'contacts' array
    body('contacts')
      .isArray({ max: 3 }).withMessage('Emergency contacts must be an array with a maximum of 3 entries.'),

    // Validate each contact object within the array
    // contacts.*.firstname
    body('contacts.*.firstname')
      .trim()
      .notEmpty().withMessage('Contact firstname is required.')
      .isString().withMessage('Contact firstname must be a string.'),
    
    // Validate each contact object within the array
    // contacts.*.lastname
    body('contacts.*.lastname')
      .trim()
      .notEmpty().withMessage('Contact lastname is required.')
      .isString().withMessage('Contact lastname must be a string.'),

    // contacts.*.phoneNumber
    body('contacts.*.phoneNumber')
        .trim()
        .notEmpty().withMessage('Contact phone number is required.')
        // Custom validation using the E.164 regex
        .matches(e164Regex).withMessage('Invalid phone number format. Must be in E.164 format (e.g., +12025550123).'),
    
    // contacts.*.email (optional)
    body('contacts.*.email')
      .optional({ checkFalsy: true })
      .isEmail().withMessage('Invalid email format for contact.')
      .normalizeEmail(),
  ],

  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const { contacts } = req.body;

    try {
      const db = req.firestoreDatabase;
        
      // Get a reference to the user's document
      const userDocRef = db.collection('users').doc(userId);

      // Check if the user document exists
      const userDoc = await userDocRef.get();
      if (!userDoc.exists) {
        return res.status(404).json({ message: 'User not found.' });
      }

      // Update the emergencyContacts field in Firestore
      await userDocRef.update({ contacts: contacts });

      res.status(200).json({
        message: 'Emergency contacts updated successfully!',
        contacts: emergencyContacts
      });

    } catch (error) {
      console.error('Error updating emergency contacts:', error);
      res.status(500).json({ message: 'Server error updating emergency contacts.', error: error.message });
    }
  }
);

// --- Protected Route: Update user preferences ---
userRouter.put(
  '/:userId/preferences',
  authenticateToken, // Protect this route with JWT authentication
  [
    // Validate that the userId in the URL matches the authenticated user's ID
    param('userId').custom((value, { req }) => {
      if (value !== req.user.userId) {
        throw new Error('Unauthorized: You can only update your own emergency contacts.');
      }
      return true;
    }),

    // Validate dashcam option
    body('dashcam')
        .optional({ checkFalsy: true })
        .toBoolean()
        .isBoolean()
        .withMessage('Dashcam field must be a boolean (true or false).'),

    // Validate cloudUploads option
    body('cloudUpload')
        .optional({ checkFalsy: true })
        .toBoolean()
        .isBoolean()
        .withMessage('CloudUpload field must be a boolean (true or false).'),
    
    // Validate emergencyAlerts option
    body('emergencyAlerts')
        .optional({ checkFalsy: true })
        .toBoolean()
        .isBoolean()
        .withMessage('emergencyAlerts field must be a boolean (true or false).'),
    
    // Validate dashcam option
    body('driverVerification')
        .optional({ checkFalsy: true })
        .toBoolean()
        .isBoolean()
        .withMessage('driverVerification field must be a boolean (true or false).'),
  ],

  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const { dashcam, cloudUpload, emergencyAlerts, driverVerification } = req.body;

    const updates = { dashcam, cloudUpload, emergencyAlerts, driverVerification }

    try {
      const db = req.firestoreDatabase;

      // Get a reference to the user's document, and assert existence
      const userDocRef = db.collection('users').doc(userId);
      const userDoc = await userDocRef.get();
      if (!userDoc.exists) {
        return res.status(404).json({ message: 'User not found.' });
      }

      // get reference to preference doc under User, and assert existence
      const preferencesDocRef = userDocRef.collection('preferences').doc('preferences');
      const preferenceDocSnapshot = await preferencesDocRef.get();

      if (preferenceDocSnapshot.exists) {
        await preferencesDocRef.update(updates);
        
        console.log(`Preferences document updated for user: ${userId}`);
        res.status(200).json({ message: 'User Preferences updated successfully!' });
      } else {
        console.warn(`Preferences document for user ${userId} does not exist. Creating it.`);

        await preferencesDocRef.set(updates);
        console.log(`Preferences document created and updated for user: ${userId}`);
        res.status(200).json({ message: 'User Preferences updated successfully!' });
      };
    } catch (error) {
      console.error('Error updating user preferences :', error);
      res.status(500).json({ message: 'Server error updating user preferences.', error: error.message });
    }
  }
);



export default userRouter;
