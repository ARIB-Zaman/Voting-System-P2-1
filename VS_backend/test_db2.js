require('dotenv').config();
const pool = require('./db');

pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'voter_otp'`)
  .then(res => console.log('OTP_COLS:', JSON.stringify(res.rows)))
  .catch(console.error)
  .finally(() => { pool.end(); process.exit(0); });
