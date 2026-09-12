/**
 * Database connection module.
 * Creates a MySQL connection pool using mysql2/promise.
 */
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'voice_calendar',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,  // Keep DATETIME as raw strings — no timezone conversion
});

// Test connection on startup
pool.getConnection()
  .then((conn) => {
    console.log('[DB] MySQL connected successfully');
    conn.release();
  })
  .catch((err) => {
    console.error('[DB] MySQL connection failed:', err.message);
  });

module.exports = pool;
