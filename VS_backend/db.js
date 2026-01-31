const { Pool } = require("pg");

const pool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "VATABASE",
    password: "7374",
    port: 5432,
});

module.exports = pool;
