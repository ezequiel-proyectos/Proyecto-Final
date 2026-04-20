const mysql = require("mysql2/promise");

let pool;

async function getPool() {
  if (pool) return pool;

  pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME || "users_db",
    user: process.env.DB_USER || "appuser",
    password: process.env.DB_PASS || "apppass",
    waitForConnections: true,
    connectionLimit: 10,
  });

  await initSchema();
  return pool;
}

async function initSchema() {
  const conn = await pool.getConnection();
  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        name        VARCHAR(120) NOT NULL,
        email       VARCHAR(180) NOT NULL UNIQUE,
        password    VARCHAR(255) NOT NULL,
        phone       VARCHAR(20),
        address     TEXT,
        role        ENUM('customer','admin') DEFAULT 'customer',
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log("[users-db] Schema listo");
  } finally {
    conn.release();
  }
}

module.exports = { getPool };
