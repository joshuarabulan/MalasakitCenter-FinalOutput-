const mysql = require("mysql2");

// Create connection pool instead of single connection
const db = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "malasakitdb5",
    port: Number(process.env.DB_PORT || 3306),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    // CRITICAL for TiDB Cloud - Add SSL configuration
    ssl: {
        rejectUnauthorized: false  // This allows connection without a CA file path
    }
});

// Test the connection
db.getConnection((err, connection) => {
    if (err) {
        console.error("Database connection failed: " + err.stack);
        console.error("Error details:", err.message);
        return;
    }
    console.log("✅ Connected to TiDB Cloud MySQL database.");
    connection.release(); // Release connection back to pool
});

module.exports = db;