const mysql = require("mysql2");

// Create connection pool for TiDB Cloud
const db = mysql.createPool({
    host: process.env.DB_HOST || "gateway01.ap-northeast-1.prod.aws.tidbcloud.com",
    user: process.env.DB_USER || "3FsdLqz3bMAkW3S.root",
    password: process.env.DB_PASSWORD || "Z9CtIuh60lfOHcC6",
    database: process.env.DB_NAME || "malasakitdb5",
    port: Number(process.env.DB_PORT || 4000),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    // SSL is REQUIRED for TiDB Cloud
    ssl: {
        rejectUnauthorized: false
    }
}); 

// Test the connection
db.getConnection((err, connection) => {
    if (err) {
        console.error("❌ Database connection failed: " + err.message);
        console.error("Please check your environment variables in Render");
        return;
    }
    console.log("Connected to TiDB Cloud MySQL database successfully!");
    connection.release();
});

module.exports = db;