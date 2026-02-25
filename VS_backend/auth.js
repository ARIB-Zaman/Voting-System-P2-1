require('dotenv').config();
const { betterAuth } = require('better-auth');
const pool = require('./db');

const auth = betterAuth({
  database: pool,
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [process.env.FRONTEND_URL],
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        defaultValue: 'PO',
        input: true,
      },
      approved: {
        type: 'boolean',
        required: false,
        defaultValue: false,
        input: false, // only set server-side (admin approval)
      },
    },
  },
});

module.exports = { auth };
