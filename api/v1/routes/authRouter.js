import { Router} from 'express';
import { body, validationResult } from 'express-validator';

const authRouter = Router()

authRouter.get('/', (req, res) => {
  // simple text response
  res.send('Hello, World! Welcome to your Express backend!');
});

authRouter.get('/login', (req, res) => {
  // Simple JSON response
  res.json({
    message: 'This is some data from your API!',
    timestamp: new Date().toISOString(),
    items: ['item1', 'item2', 'item3']
  });
});


// define validators
const email_validator = body('email')
    .isEmail().withMessage('Please enter a valid email address.')
    .normalizeEmail()

const password_validator = body('password')
    .isLength({ min: 8, max: 12 }).withMessage('Password must be at least between 8 and 12 characters long.')
    .matches(/\d/).withMessage('Password must contain at least one number.')
    // .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character.'), // Must contain a special character

const firstname_validator = body('firstname')
      .trim()
      .notEmpty().withMessage('First name is required.')
    //   .isLength({ min: 3, max: 20 }).withMessage('First name must be between 3 and 20 characters.')

const lastname_validator = body('lastname')
      .trim()
      .notEmpty().withMessage('Last name is required.')
    //   .isLength({ min: 3, max: 20 }).withMessage('Last name must be between 3 and 20 characters.')


authRouter.post(
  '/signup',
  [ email_validator, password_validator, firstname_validator, lastname_validator ],
  (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      // If there are validation errors, return a 400 Bad Request with the errors
      return res.status(400).json({ errors: errors.array() });
    }

    // If validation passes, process the signup data
    const { email, password, firstname, lastname } = req.body;
    
    // In a real application, you would:
    // 1. Hash the password (e.g., using bcrypt)
    // 2. Save the user data to a database
    // 3. Generate a JWT or session token for the user
    // For this example, we'll just log the data and send a success message.

    console.log('Signup Data Received:');
    console.log(`Email: ${email}`);
    console.log(`Firstname: ${firstname}`);
    console.log(`Lastname: ${lastname}`);

    res.status(201).json({
      message: 'User signed up successfully!',
      user: {
        email,
        firstname,
        lastname,
        password
      }
    });
  }
);

export default authRouter;