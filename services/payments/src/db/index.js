const mysql = require("mysql2/promise");

let pool;

async function getPool() {
  if (pool) return pool;
  pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME || "payments_db",
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
      CREATE TABLE IF NOT EXISTS payments (
        id             INT AUTO_INCREMENT PRIMARY KEY,
        order_id       INT NOT NULL UNIQUE,
        user_id        INT NOT NULL,
        amount         DECIMAL(10,2) NOT NULL,
        method         ENUM('card','cash','wallet') DEFAULT 'card',
        status         ENUM('pending','approved','rejected','refunded') DEFAULT 'pending',
        transaction_id VARCHAR(100),
        created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log("[payments-db] Schema listo");
  } finally {
    conn.release();
  }
}

module.exports = { getPool };
