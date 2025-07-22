import { Router } from 'express';
import { validationResult } from 'express-validator';
import { guardian_array_count_validator, guardian_firstname_validator, guardian_lastname_validator, guardian_phone_validator, guardian_email_validator, getOptionalBooleanValidator, guardian_contact_method_validator, getBooleanValidatorWithFalseDefault } from '../utils/validators.js';

import 'dotenv/config';
import { authenticateToken } from './authRouter.js';

const userRouter = Router();
// const JWT_SECRET = process.env.JWT_SECRET;


// middleware for comparing userid in params and jwt
function authorizeUserParams(req, res, next){
    if (req.params.userId !== req.user.userId) {
        return res.status(403).json({message: "Unauthorized: You can only access resources for your own User ID."});
    }

    next();
}

async function sendAlertToContact (contact, senderEmail, senderName) {
  const mailOptions = {
      from: senderEmail,
      to: contact.email,
      subject: `EMERGENCY ALERT from ${senderName}`,
      text: `Hello ${contact.name},\n\n${senderName} has triggered an emergency alert. Please check on them immediately.<\n`,
      html: `<p>Hello ${contact.name},</p><p><b>${senderName}</b> has triggered an emergency alert.</p><p>Please check on them immediately.</p>`
    }

    try {
      await transporter.sendMail(mailOptions);
      console.log(`    Email sent to ${contact.name} (${contact.email})`);
    } catch (error) {
      console.error(`    Failed to send email to ${contact.name} (${contact.email}):`, error.message);
    }
}

async function sendAlert(guardians, firstname, lastname){
  console.log(`--- EMERGENCY ALERT INITIATED by User:  ${firstname} ${lastname}---`);
  console.log(`Sending to ${guardians.length} guardians:`);
  const senderName = `${firstname} ${lastname}`
  
  // Send alerts to each guardian
  guardians.forEach(async contact => {
    sendAlertToContact(contact,
      senderEmail=process.env.SENDER_EMAIL,
      senderName=senderName);
  });

  console.log(`--------------------------------------------------`);

}

// --- Protected Route: Update Guardians ---
userRouter.put(
  '/:userId/guardians',
  authenticateToken, // Protect this route with JWT authentication
  authorizeUserParams,
  [
    guardian_array_count_validator,
    guardian_firstname_validator,
    guardian_lastname_validator,
    guardian_phone_validator,
    guardian_email_validator,
    guardian_contact_method_validator,
    getBooleanValidatorWithFalseDefault('guardians.*.share_location')
  ],

  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const { guardians } = req.body;

    try {
      const db = req.firestoreDatabase;
        
      // Get a reference to the user's document
      const userDocRef = db.collection('users').doc(userId);

      // Check if the user document exists
      const userDoc = await userDocRef.get();
      if (!userDoc.exists) {
        return res.status(404).json({ message: 'User not found.' });
      }

      // Update the guardians field in Firestore
      await userDocRef.update({ guardians: guardians });

      res.status(200).json({
        message: 'Guardians updated successfully!',
        guardians,
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
  authorizeUserParams,
  [
    getOptionalBooleanValidator('dashcam'),
    getOptionalBooleanValidator('cloudUpload'),
    getOptionalBooleanValidator('emergencyAlerts'),
    getOptionalBooleanValidator('driverVerification'),
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

// --- Protected Route: Update user privacy configs ---
userRouter.put(
  '/:userId/privacy_config',
  authenticateToken, // Protect this route with JWT authentication
  authorizeUserParams,
  [
    getOptionalBooleanValidator('dataSharing'),
    getOptionalBooleanValidator('videoRetention'),
    getOptionalBooleanValidator('nightMode'),
  ],

  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const { dataSharing, videoRetention, nightMode } = req.body;

    const updates = { dataSharing, videoRetention, nightMode };

    try {
      const db = req.firestoreDatabase;

      // Get a reference to the user's document, and assert existence
      const userDocRef = db.collection('users').doc(userId);
      const userDoc = await userDocRef.get();
      if (!userDoc.exists) {
        return res.status(404).json({ message: 'User not found.' });
      }

      // get reference to privacy_config doc under User, and assert existence
      const privacyConfigDocRef = userDocRef.collection('privacy_config').doc('privacy_config');
      const privacyConfigDocSnapshot = await privacyConfigDocRef.get();

      if (privacyConfigDocSnapshot.exists) {
        await privacyConfigDocRef.update(updates);
        
        console.log(`'privacy_config' document updated for user: ${userId}`);
        res.status(200).json({ message: 'User Privacy Configs updated successfully!' });
      } else {
        console.warn(`'privacy_config' document for user ${userId} does not exist. Creating it.`);

        await privacyConfigDocRef.set(updates);
        console.log(`Preferences document created and updated for user: ${userId}`);
        res.status(200).json({ message: 'User Privacy Configs updated successfully!' });
      };
    } catch (error) {
      console.error('Error updating user privacy configs :', error);
      res.status(500).json({ message: 'Server error updating user privacy configs.', error: error.message });
    }
  }
);

// --- get user info ---
userRouter.get(
  '/user',
  authenticateToken,
  async (req, res) => {
    const {userId} =  req.user

    try {
      const db = req.firestoreDatabase;

      const userDocRef = db.collection('users').doc(userId);
      const userDoc = await userDocRef.get();
      if (!userDoc.exists) {
        return res.status(404).json({ message: 'User not found.' });
      }

      const { email, firstname, lastname, contact_method } = userDoc.data();
      const userData = {
        userId,
        email,
        firstname,
        lastname,
        contact_method
      };

      return res.status(200).json({message: 'User fetched successfully.', data: userData});
    
    } catch (error) {
      console.error('Error fetching user :', error);
      res.status(500).json({ message: 'Server error fetching user.', error: error.message });
    }

  }
);

// --- get guardians ---
userRouter.get(
  '/:userId/guardians',
  authenticateToken,
  async (req, res) => {
    const {userId} =  req.params

    try {
      const db = req.firestoreDatabase;

      const userDocRef = db.collection('users').doc(userId);
      const userDoc = await userDocRef.get();
      if (!userDoc.exists) {
        return res.status(404).json({ message: 'User not found.' });
      }

      const userGuardiansData = userDoc.data()?.guardians || [];

      return res.status(200).json({message: 'Guardians fetched successfully.', data: userGuardiansData});
    
    } catch (error) {
      console.error('Error fetching Guardians :', error);
      res.status(500).json({ message: 'Server error fetching Guardians.', error: error.message });
    }

  }
);

// --- get preferences ---
userRouter.get(
  '/:userId/preferences',
  authenticateToken,
  async (req, res) => {
    const {userId} =  req.params;

    try {
      const db = req.firestoreDatabase;

      const userDocRef = db.collection('users').doc(userId);
      const userDoc = await userDocRef.get();
      if (!userDoc.exists) {
        return res.status(404).json({ message: 'User not found.' });
      }

      // get reference to preference doc under User, and assert existence
      const preferencesDocRef = userDocRef.collection('preferences').doc('preferences');
      const preferenceDocSnapshot = await preferencesDocRef.get();

      if (preferenceDocSnapshot.exists) {
        const userPreferenceData = await preferenceDocSnapshot.data();
        
        res.status(200).json({ message: 'User Preferences fetched successfully.', data: userPreferenceData });
      } else {
        console.warn(`Preferences document for user ${userId} does not exist.`);
        res.status(404).json({ message: 'User Preferences not set.' });
      };

    } catch (error) {
      console.error('Error fetching Preferences :', error);
      res.status(500).json({ message: 'Server error fetching Preferences.', error: error.message });
    }

  }
);

// --- get privacy configs ---
userRouter.get(
  '/:userId/privacy_config',
  authenticateToken,
  async (req, res) => {
    const {userId} =  req.params;

    try {
      const db = req.firestoreDatabase;

      const userDocRef = db.collection('users').doc(userId);
      const userDoc = await userDocRef.get();
      if (!userDoc.exists) {
        return res.status(404).json({ message: 'User not found.' });
      }

      // get reference to privacy configs doc under User, and assert existence
      const privacyConfigDocRef = userDocRef.collection('privacy_config').doc('privacy_config');
      const privacyConfigDocSnapshot = await privacyConfigDocRef.get();

      if (privacyConfigDocSnapshot.exists) {
        const userPrivacyConfigData = await privacyConfigDocSnapshot.data();
        
        res.status(200).json({ message: 'User Privacy Configs fetched successfully.', data: userPrivacyConfigData });
      } else {
        console.warn(`Privacy Configs document for user ${userId} does not exist.`);
        res.status(404).json({ message: 'User Privacy Configs not set.' });
      };

    } catch (error) {
      console.error('Error fetching Privacy Configs :', error);
      res.status(500).json({ message: 'Server error fetching Privacy Configs.', error: error.message });
    }

  }
);

// --- send emergency alert ---
userRouter.post(
  '/alert',
  authenticateToken,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.user;

    try {
      const db = req.firestoreDatabase;

      const userDocRef = db.collection('users').doc(userId);
      const userDoc = await userDocRef.get();

      if (!userDoc.exists) {
        return res.status(404).json({ message: 'Authenticated user not found.' });
      }

      const userData = userDoc.data();
      const guardians = userData.guardians || [];

      if (guardians.length === 0) {
        return res.status(400).json({ message: 'No guardians found for this user.' });
      }

      sendAlert(guardians, userData.firstname, userData.lastname);

      res.status(200).json({
        message: 'Emergency alert sent successfully to your guardians.',
        sentToGuardians: guardians.map(c => ({ name: c.name, phoneNumber: c.phoneNumber, email: c.email })) // Renamed
      });

    } catch (error) {
      console.error('Error sending emergency alert:', error);
      res.status(500).json({ message: 'Server error sending emergency alert.', error: error.message });
    }
  }
);


export default userRouter;
