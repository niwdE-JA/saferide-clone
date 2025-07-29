import { Router } from 'express';
import 'dotenv/config';
import { authenticateToken } from './authRouter.js';
import axios from 'axios';


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
    (req, res) => {
    const authUrl = `${UBER_AUTHORIZE_URL}?` +
        `client_id=${UBER_CLIENT_ID}&` +
        `response_type=code&` +
        `redirect_uri=${UBER_REDIRECT_URI}`
        // + `scope=profile%20history%20request%20request_receipt%20all_trips`; // Define the scopes your app needs

    // Redirect the user's browser to Uber's authorization page
    res.status(200).json({ message: "generated Uber authorization url ", authUrl: authUrl });
});

rideRouter.get('/uber/callback',
    authenticateToken,
    async (req, res) => {
    const authorizationCode = req.query.code;
    const state = req.query.state;

    if (!authorizationCode) {
        return res.status(400).json({ error: 'Authorization code not received.' });
    }

    console.log("authorizationCode : ", authorizationCode);
    // return res.status(200).json({message: "SUCCESS", code: authorizationCode})

    // You should validate the 'state' parameter here if you used it.

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

        const {userId} = req.user;
        const userUberTokens = {
            accessToken: access_token,
            refreshToken: refresh_token,
            expiresIn: expires_in,
            timestamp: Date.now() // Store timestamp for token expiry checks
        };

        // console.log(`Tokens for ${userId}: `, userUberTokens);        
        res.status(200).json({ message: 'Uber authentication successful.', userUberTokens });

    } catch (error) {
        console.error('Error exchanging authorization code for token:', error.response ? error.response.data : error.message);
        // In a real app, redirect to a frontend error page or return a JSON error.
        res.status(500).json({
            error: 'Failed to obtain access token.',
            details: error.response ? error.response.data : error.message
        });
    }
});

export default rideRouter;
