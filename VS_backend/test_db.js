require('dotenv').config();
const pool = require('./db');

pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'voter_otp'`)
  .then(res => console.log('COLUMNS_VOTER_OTP:', JSON.stringify(res.rows)))
  .catch(console.error)
  .finally(() => process.exit());
