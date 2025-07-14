import { Router} from 'express';
import { validationResult } from 'express-validator';
import { email_validator, password_validator, firstname_validator, lastname_validator } from '../utils/validators.js';

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// load jwt secret
const JWT_SECRET = process.env.JWT_SECRET;

const authRouter = Router()

authRouter.get('/', (req, res) => {
  // simple text response
  res.send('Hello, World! Welcome to your Express backend!');
});


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
      // Check if user already exists (by email)
      const usersRef = db.collection('users');
      const emailSnapshot = await usersRef.where('email', '==', email).get();

      if (!emailSnapshot.empty) {
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
        createdAt: admin.firestore.FieldValue.serverTimestamp() // Timestamp for creation
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

export default authRouter;