import express, { json } from 'express';
import apiRouter  from './api/v1/apiRouter.js';
import admin from 'firebase-admin';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

const app = express();

const PORT = process.env.PORT || 8080; // listening port

// Initialize Firebase
try {
  const firebaseConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined, // Replace escaped newlines
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  };

//   console.log(firebaseConfig)

  // Check if all necessary Firebase config variables are set
  if (!firebaseConfig.projectId || !firebaseConfig.privateKey || !firebaseConfig.clientEmail) {
    throw new Error('Missing Firebase environment variables. Please set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL.');
  }

  admin.initializeApp({
    credential: admin.credential.cert(firebaseConfig)
  });
  console.log('Firebase Admin SDK initialized successfully using environment variables.');
} catch (error) {
  console.error('Failed to initialize Firebase Admin SDK. Check your Firebase environment variables.', error);
  // Exit the process if Firebase initialization fails, as the app won't function correctly.
  process.exit(1);
}

const db = admin.firestore(); // Get a Firestore instance

// parse body to json
app.use(json());
// 
app.use('/api/v1', apiRouter)


// Run Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
