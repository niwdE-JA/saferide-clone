import express, { Router, json } from 'express';
import { body, validationResult } from 'express-validator';

const app = express();
const apiRouter = Router()

const PORT = process.env.PORT || 3000; // listening port


// parse body to json
app.use(json());
// 
app.use('/api', apiRouter)


apiRouter.get('/', (req, res) => {
  // simple text response
  res.send('Hello, World! Welcome to your Express backend!');
});

apiRouter.get('/login', (req, res) => {
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



app.post(
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


// Run Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
