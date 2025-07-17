import { Router } from 'express';
import { validationResult } from 'express-validator';
import { email_validator, password_validator, firstname_validator, lastname_validator } from '../utils/validators.js';

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import 'dotenv/config';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SENDER_EMAIL,
        pass: process.env.SENDER_EMAIL_PASSWORD
    }
});

const authRouter = Router();
const JWT_SECRET = process.env.JWT_SECRET;
const _5_MINUTES_IN_MILLISECONDS = 5 * 60 * 1000;
const OTP_DURATION = _5_MINUTES_IN_MILLISECONDS;


function generateOTP (digits = 6) { // default number of digits is 6
  max_num = (10^digits) - 1;
  return Math.floor(Math.random() * max_num).toString().padStart(digits);
};

async function sendOTP (otp, email, otp_duration) {
    // Calculate expiration time in minutes for the email message
    const durationMinutes = otp_duration / 60000;

    // Define the email content
    const mailOptions = {
        from: `"SafeRide" <${process.env.SENDER_EMAIL}>`,
        to: email,
        subject: 'Your One-Time Password (OTP) for Verification',
        html: `
            <p>Hello,</p>
            <p>Your One-Time Password (OTP) for verification is:</p>
            <h2 style="color: #007bff;">${otp}</h2>
            <p>This OTP is valid for ${durationMinutes} minutes. Please do not share it with anyone.</p>
            <p>If you did not request this, please ignore this email.</p>
            <p>Thanks,<br>SafeRide Team</p>
        `,
        text: `Your One-Time Password (OTP) for verification is: ${otp}. This OTP is valid for ${durationMinutes} minutes. Please do not share it with anyone. If you did not request this, please ignore this email. Thanks, SafeRide Team`,
    };

    try {
        // Send the email
        let info = await transporter.sendMail(mailOptions);
        console.log(`--- OTP SENT VIA EMAIL ---`);
        console.log(`Message sent: %s`, info.messageId);
        console.log(`Preview URL: %s`, nodemailer.getTestMessageUrl(info)); // Only available with Ethereal/Mailtrap for testing
        console.log(`To: ${email}`);
        console.log(`OTP: ${otp}`);
        console.log(`Expiration: ${durationMinutes} minutes.`);
        console.log(`--------------------------`);
    } catch (error) {
        console.error(`--- FAILED TO SEND OTP EMAIL ---`);
        console.error(`Error sending email to ${email}:`, error);
        console.error(`---------------------------------`);
        throw new Error(`Error sending email to ${email}: \t ${error}`);
        
    }
}


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

      // OTP Generation
      const otp = generateOTP();
      const otpExpiry = new Date(Date.now() + OTP_DURATION); // OTP valid for 5 minutes

      // Store the new user in Firestore
      const newUserRef = await usersRef.add({
        firstname: firstname,
        lastname: lastname,
        email: email,
        password: hashedPassword,
        createdAt: FieldValue.serverTimestamp(), // Timestamp for creation
        otp: otp,
        otpExpiry: Timestamp.fromDate(otpExpiry)

      });

      // Get the ID of the newly created user document
      const userId = newUserRef.id;
    
      sendOTP(otp, email, OTP_DURATION);

      res.status(200).json({
        message: 'Login successful. OTP sent to your email. Please verify OTP to complete login.',
        userId: userId
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

      // OTP Generation and Storage
      const otp = generateOTP();
      const otpExpiry = new Date(Date.now() + OTP_DURATION); // OTP valid for 5 minutes

      await usersRef.doc(userId).update({
        otp: otp,
        otpExpiry: Timestamp.fromDate(otpExpiry)
      });
    
      sendOTP(otp, email, OTP_DURATION);

      res.status(200).json({
        message: 'Login successful. OTP sent to your email. Please verify OTP to complete login.',
        userId: userId
      });

    } catch (error) {
      console.error('Error during login:', error);
      res.status(500).json({ message: 'Server error during login.', error: error.message });
    }
  }
);

authRouter.post(
  '/verify-otp',
  [
    body('userId').notEmpty().withMessage('User ID is required.'),
    body('otp').notEmpty().withMessage('OTP is required.').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits long.')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId, otp } = req.body;

    try {
      const userDocRef = db.collection('users').doc(userId);
      const userDoc = await userDocRef.get();

      if (!userDoc.exists) {
        return res.status(404).json({ message: 'User not found.' });
      }

      const userData = userDoc.data();
      const storedOtp = userData.otp;
      const storedOtpExpiry = userData.otpExpiry?.toDate();

      // Check if OTP exists and is not expired
      if (!storedOtp || storedOtp !== otp || !storedOtpExpiry || storedOtpExpiry < new Date()) {
        // Clear OTP immediately if invalid or expired to prevent brute-force
        await userDocRef.update({
            otp: FieldValue.delete(),
            otpExpiry: FieldValue.delete()
        });
        return res.status(401).json({ message: 'Invalid or expired OTP.' });
      }

      // OTP is valid and not expired, so issue JWT
      const token = jwt.sign(
        { userId: userId, email: userData.email },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Clear OTP from Firestore after successful verification
      await userDocRef.update({
        otp: FieldValue.delete(),
        otpExpiry: FieldValue.delete()
      });

      res.status(200).json({
        message: 'OTP verified successfully! Logged in.',
        token: token,
        user: {
          userId: userId,
          username: userData.username,
          email: userData.email
        }
      });

    } catch (error) {
      console.error('Error during OTP verification:', error);
      res.status(500).json({ message: 'Server error during OTP verification.', error: error.message });
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