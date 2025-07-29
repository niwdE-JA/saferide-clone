import { Router } from 'express';
import 'dotenv/config';
import { authenticateToken } from './authRouter.js';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';


const rideRouter = Router();
// const JWT_SECRET = process.env.JWT_SECRET;

// --- Configuration ---
const UBER_CLIENT_ID = process.env.UBER_CLIENT_ID; // Replace with your Uber Client ID
const UBER_CLIENT_SECRET = process.env.UBER_CLIENT_SECRET; // Replace with your Uber Client Secret
const UBER_REDIRECT_URI = `${process.env.SERVER_API_BASE_URI}/rides/uber/callback`; // Must match the redirect URI configured in your Uber Developer app

// Uber API Endpoints
const UBER_API_BASE_URL = process.env.UBER_API_BASE_URL;
const UBER_AUTHORIZE_URL = `${UBER_API_BASE_URL}/authorize`;
const UBER_TOKEN_URL = `${UBER_API_BASE_URL}/token`;


rideRouter.get(
    '/uber/auth-url',
    authenticateToken,
    async (req, res) => {
        const {userId} = req.user;

        // Generate a unique, cryptographically secure state value using UUID v4
        const state = uuidv4();
        // Store the state in the user's database for later verification
        try {
            const db = req.firestoreDatabase;

            // Get a reference to the user's document, and assert existence
            const userDocRef = db.collection('users').doc(userId);
            const userDoc = await userDocRef.get();
            if (!userDoc.exists) {
                return res.status(404).json({ message: 'User not found.' });
            }

            // stores state in user database
            await userDocRef.set({ uberAuthState: state }, { merge: true });

            // 
            const authUrl = `${UBER_AUTHORIZE_URL}?` +
                `client_id=${UBER_CLIENT_ID}&` +
                `response_type=code&` +
                `redirect_uri=${UBER_REDIRECT_URI}&` +
                `state=${state}`;
                // + `scope=profile%20history%20request%20request_receipt%20all_trips`; // Define the scopes your app needs

            // Redirect the user's browser to Uber's authorization page
            res.status(200).json({ message: "generated Uber authorization url ", authUrl: authUrl });
            
        } catch (error) {
            console.error('Error generating uber authentication url :', error);
            res.status(500).json({ message: 'Server error generating uber authentication url.', error: error.message });
        }

        }
);

rideRouter.get(
    '/uber/callback',
    async (req, res) => {
        const authorizationCode = req.query.code;
        const state = req.query.state;

        if (!authorizationCode) {
            return res.status(400).json({ error: 'Authorization code not received.' });
        }

        try {
            // Exchange the authorization code for an access token
            const tokenResponse = await axios.post(UBER_TOKEN_URL, new URLSearchParams({
                client_id: UBER_CLIENT_ID,
                client_secret: UBER_CLIENT_SECRET,
                grant_type: 'authorization_code',
                redirect_uri: UBER_REDIRECT_URI,
                code: authorizationCode
            }).toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            const { access_token, refresh_token, expires_in } = tokenResponse.data;

            const userUberTokens = {
                accessToken: access_token,
                refreshToken: refresh_token,
                expiresIn: expires_in,
                timestamp: Date.now()
            };

            // get userId from firebase database using the state uuid
            const db = req.firestoreDatabase;
            const userDoc = await db.collection('users').where('uberAuthState', '==', state).limit(1).get();
            if (userDoc.empty) {
                return res.status(404).json({ error: 'User not found.' });
            }

            const userId = userDoc.docs[0].id;

            // Store the tokens in the user's database
            await db.collection('users').doc(userId).set({ uberTokens: userUberTokens }, { merge: true });

            res.status(200).json({ message: 'Uber authentication successful.', userUberTokens });

        } catch (error) {
            console.error('Error exchanging authorization code for token:', error.response ? error.response.data : error.message);
            
            res.status(500).json({
                error: 'Failed to obtain access token.',
                details: error.response ? error.response.data : error.message
            });
        }
    }
);


rideRouter.get('/uber/profile',
    authenticateToken,
    async (req, res) => {
        // basic user profile information from the uber api and storing it in a firebase document under user
        try {
            const { userId } = req.user;
            const db = req.firestoreDatabase;

            // get user document from firebase and assert existence
            const userDoc = await db.collection('users').doc(userId).get();
            if (!userDoc.exists) {
                return res.status(404).json({ error: 'User not found.' });
            }

            // get the user's uber access token from the user document
            const userData = userDoc.data();

            if (!userData.uberTokens?.accessToken) {
                return res.status(401).json({ error: 'Uber access token not found for user.' });
            }

            const accessToken = userData.uberTokens.accessToken;
            if (!accessToken) {
                return res.status(401).json({ error: 'Uber access token not found for user.' });
            }

            const profileResponse = await axios.get(`https://sandbox-api.uber.com/v2/me`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            });

            // Here you would store profileResponse.data in your Firebase document for the user
            // For now, just return the profile data
            res.status(200).json({ message: 'Uber profile fetched successfully.', profile: profileResponse.data });
        } catch (error) {
            console.error('Error fetching Uber profile:', error.response ? error.response.data : error.message);
            res.status(500).json({
                error: 'Failed to fetch Uber profile.',
                details: error.response ? error.response.data : error.message
            });
        }
    }
);


export default rideRouter;
