const mysql = require("mysql2/promise");

let pool;

async function getPool() {
  if (pool) return pool;
  pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME || "catalog_db",
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
      CREATE TABLE IF NOT EXISTS restaurants (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        name        VARCHAR(150) NOT NULL,
        description TEXT,
        address     VARCHAR(255),
        phone       VARCHAR(20),
        category    VARCHAR(80),
        is_open     TINYINT(1) DEFAULT 1,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS dishes (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        restaurant_id INT NOT NULL,
        name          VARCHAR(150) NOT NULL,
        description   TEXT,
        price         DECIMAL(10,2) NOT NULL,
        category      VARCHAR(80),
        is_available  TINYINT(1) DEFAULT 1,
        created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
      )
    `);
    console.log("[catalog-db] Schema listo");
  } finally {
    conn.release();
  }
}

module.exports = { getPool };
