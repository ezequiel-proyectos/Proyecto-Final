const mysql = require("mysql2/promise");

let pool;

async function getPool() {
  if (pool) return pool;
  pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME || "orders_db",
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
      CREATE TABLE IF NOT EXISTS orders (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        user_id       INT NOT NULL,
        restaurant_id INT NOT NULL,
        status        ENUM('pending','confirmed','preparing','on_the_way','delivered','cancelled')
                      DEFAULT 'pending',
        total         DECIMAL(10,2) NOT NULL,
        address       TEXT NOT NULL,
        notes         TEXT,
        created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS order_items (
        id        INT AUTO_INCREMENT PRIMARY KEY,
        order_id  INT NOT NULL,
        dish_id   INT NOT NULL,
        dish_name VARCHAR(150) NOT NULL,
        price     DECIMAL(10,2) NOT NULL,
        quantity  INT NOT NULL DEFAULT 1,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      )
    `);
    console.log("[orders-db] Schema listo");
  } finally {
    conn.release();
  }
}

module.exports = { getPool };
