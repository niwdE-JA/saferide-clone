import { Router } from 'express';
import { validationResult } from 'express-validator';
import { getOptionalBooleanValidator, guardian_contact_method_validator, getBooleanValidatorWithFalseDefault, firstname_validator, lastname_validator, phone_validator, email_validator } from '../utils/validators.js';

import 'dotenv/config';
import { authenticateToken } from './authRouter.js';
import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SENDER_EMAIL,
        pass: process.env.SENDER_EMAIL_PASSWORD
    }
});

const userRouter = Router();
// const JWT_SECRET = process.env.JWT_SECRET;
const DEFAULT_PREFERENCE = {
  'dashcam': false,
  'cloudUpload': false,
  'emergencyAlerts': true,
  'driverVerification': false,
}
const DEFAULT_PRIVACY_CONFIG = {
  'dataSharing': false,
  'videoRetention': false,
  'nightMode': false,
}

function fillDefaults (default_object, current_object){
  return { ...default_object, ...current_object };
}

function removeUndefinedFields(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => typeof value !== 'undefined')
  );
}


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
      text: `Hello ${contact.firstname},\n\n${senderName} has triggered an emergency alert. Please check on them immediately.<\n`,
      html: `<p>Hello ${contact.firstname},</p><p><b>${senderName}</b> has triggered an emergency alert.</p><p>Please check on them immediately.</p>`
    }

  try {
    await transporter.sendMail(mailOptions);
    console.log(`    Email sent to ${contact.firstname} (${contact.email})`);
  } catch (error) {
    console.error(`    Failed to send email to ${contact.firstname} (${contact.email}):`, error.message);
  }
}

async function sendAlert(guardians, firstname, lastname){
  console.log(`--- EMERGENCY ALERT INITIATED by User:  ${firstname} ${lastname}---`);
  console.log(`Sending to ${guardians.length} guardians:`);
  const senderName = `${firstname} ${lastname}`
  
  // Send alerts to each guardian
  guardians.forEach(async contact => {
    sendAlertToContact(contact,
      process.env.SENDER_EMAIL,
      senderName);
  });

  console.log(`--------------------------------------------------`);

}

// --- Protected Route: Update Guardians ---
userRouter.put(
  '/:userId/guardians',
  authenticateToken,
  authorizeUserParams,
  [
    firstname_validator,
    lastname_validator,
    phone_validator,
    email_validator,
    guardian_contact_method_validator,
    getBooleanValidatorWithFalseDefault('share_location')
  ],

  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const {
      firstname,
      lastname,
      phone,
      email,
      contact_method,
      share_location
    } = req.body;

    // A unique ID for the new guardian
    const guardianId = uuidv4();

    try {
      const db = req.firestoreDatabase;
      
      // Get a reference to the user's document
      const userDocRef = db.collection('users').doc(userId);
      const userDoc = await userDocRef.get();

      // Assert user existence
      if (!userDoc.exists) {
        return res.status(404).json({ message: 'User not found.' });
      }

      // Get the current list of guardians from the user's document
      // If 'guardians' field doesn't exist, initialize as an empty array
      const userData = userDoc.data();
      let currentGuardians = userData.guardians || [];

      // Check if the maximum number of guardians has been reached
      if (currentGuardians.length >= 3) {
        return res.status(400).json({ message: 'Maximum of 3 guardians allowed. Please remove an existing guardian to add a new one.' });
      }

      // Create the new guardian object with its own unique ID
      const newGuardian = {
        id: guardianId, // Unique ID for this specific guardian
        firstname,
        lastname,
        phone,
        email,
        contact_method, // This should be the array of strings validated by guardian_contact_method_validator
        share_location,
      };

      // Add the new guardian to the existing list
      currentGuardians.push(newGuardian);

      // Update the user document in Firestore with the new array of guardians
      await userDocRef.update({
        guardians: currentGuardians
      }, { ignoreUndefinedProperties: true });

      return res.status(201).json({
        message: 'Guardian added successfully.',
        currentGuardians
      });
    } catch (error) {
      console.error('Error updating Guardians:', error);
      res.status(500).json({ message: 'Server error updating Guardians.', error: error.message });
    }
  }
);

// --- Protected Route: Update specific guardian by Id ---
userRouter.put(
  '/:userId/guardians/:guardianId',
  authenticateToken,
  authorizeUserParams,
  [
    firstname_validator,
    lastname_validator,
    phone_validator,
    email_validator,
    guardian_contact_method_validator,
    getBooleanValidatorWithFalseDefault('share_location')
  ],

  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const {
      firstname,
      lastname,
      phone,
      email,
      contact_method,
      share_location
    } = req.body;

    // extract Id from params
    const {guardianId} = req.params;

    try {
      const db = req.firestoreDatabase;
      
      // Get a reference to the user's document
      const userDocRef = db.collection('users').doc(userId);
      const userDoc = await userDocRef.get();

      // Assert user existence
      if (!userDoc.exists) {
        return res.status(404).json({ message: 'User not found.' });
      }

      // Get the current list of guardians from the user's document
      // If 'guardians' field doesn't exist, initialize as an empty array
      const userData = userDoc.data();
      let currentGuardians = userData.guardians || [];

      // Check if the guardianId exists in the list
      if ( ! currentGuardians.some(guardian => guardian.id === guardianId)) {
        return res.status(404).json({ message: 'no guardian found with that id.' });
      }

      // change matching gurdian to new guardian object
      const updatedGuardianData = {
        firstname,
        lastname,
        phone,
        email,
        contact_method, // This should be the array of strings validated by guardian_contact_method_validator
        share_location,
      };

      const updatedGuardians = currentGuardians.map(guardian=>{
        if (guardian.id === guardianId){
          return { ...guardian, ...updatedGuardianData };
        } else {
          return guardian;
        }
      });

      // Update the user document in Firestore with the new array of guardians
      await userDocRef.update({
        guardians: updatedGuardians
      }, { ignoreUndefinedProperties: true });

      return res.status(201).json({
        message: 'Guardian updated successfully.',
        updatedGuardians
      });
    } catch (error) {
      console.error('Error updating Guardian :', error);
      res.status(500).json({ message: 'Server error updating Guardian.', error: error.message });
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

    const updates = removeUndefinedFields({ dashcam, cloudUpload, emergencyAlerts, driverVerification })

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

    const updates = removeUndefinedFields({ dataSharing, videoRetention, nightMode });

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
        
        res.status(200).json({ message: 'User Preferences fetched successfully.', data: fillDefaults(DEFAULT_PREFERENCE, userPreferenceData )});
      } else {
        console.warn(`Preferences document for user ${userId} does not exist. Returning default.`);
        res.status(200).json({ message: 'Fetched Default User Preferences.', data: DEFAULT_PREFERENCE });
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
        
        res.status(200).json({ message: 'User Privacy Configs fetched successfully.', data: fillDefaults(userPrivacyConfigData) });
      } else {
        console.warn(`Privacy Configs document for user ${userId} does not exist.`);
        res.status(200).json({ message: 'Fetched default Privacy Configs.', data: DEFAULT_PRIVACY_CONFIG });
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

      // Log alerts in Firestore under /users/{userId}/alerts/{alert_id}
      const alertId = uuidv4();
      const timestamp = new Date().toISOString();
      const alertLog = {
        alertId,
        timestamp,
        sentToGuardians: guardians.map(g => ({
          id: g.id,
          firstname: g.firstname,
          lastname: g.lastname,
          phone: g.phone,
          email: g.email,
          contact_method: g.contact_method,
          share_location: g.share_location
        }))
      };
      await userDocRef.collection('alerts').doc(alertId).set(alertLog);

      res.status(200).json({
        message: 'Emergency alert sent successfully to your guardians.',
        sentToGuardians: guardians.map(c => ({
          firstname: c.firstname,
          lastname: c.lastname,
          phone: c.phone,
          email: c.email
        }))
      });

    } catch (error) {
      console.error('Error sending emergency alert:', error);
      res.status(500).json({ message: 'Server error sending emergency alert.', error: error.message });
    }
  }
);

// --- Protected Route: Delete Guardian ---
userRouter.delete(
  '/:userId/guardians/:guardianId',
  authenticateToken,
  authorizeUserParams,
  async (req, res) => {
    const { userId, guardianId } = req.params;

    try {
      const db = req.firestoreDatabase;
      
      // Get a reference to the user's document and assert user existence
      const userDocRef = db.collection('users').doc(userId);
      const userDoc = await userDocRef.get();
      if (!userDoc.exists) {
        return res.status(404).json({ message: 'User not found.' });
      }

      // Get the current list of guardians from the user's document
      const userData = userDoc.data();
      let currentGuardians = userData.guardians || [];

      // Find the index of the guardian to be deleted
      const guardianIndexToDelete = currentGuardians.findIndex(
        guardian => guardian.id === guardianId
      );

      // Check if the guardian was found
      if (guardianIndexToDelete === -1) {
        return res.status(404).json({ message: 'Guardian not found for this user.' });
      }

      // Remove the guardian from the array
      const deletedGuardian = currentGuardians.splice(guardianIndexToDelete, 1); // splice returns an array of deleted elements

      // Update the user document in Firestore with the modified array of guardians
      await userDocRef.update({
        guardians: currentGuardians
      }, { ignoreUndefinedProperties: true });

      return res.status(200).json({
        message: 'Guardian deleted successfully.',
        deletedGuardianId: guardianId,
        currentGuardians
      });

    } catch (error) {
      console.error(`Error deleting guardian ${guardianId} for user ${userId}:`, error);
      return res.status(500).json({ message: 'Failed to delete guardian.', error: error.message });
    }
  }
);

export default userRouter;
